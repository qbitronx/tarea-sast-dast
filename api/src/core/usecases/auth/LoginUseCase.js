const { UnauthorizedError } = require('../../domain/errors');

class LoginUseCase {
  /** @param {{ userRepository, passwordService, tokenService }} ports */
  constructor({ userRepository, passwordService, tokenService }) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
  }

  async execute({ email, password }) {
    const record = await this.userRepository.findByEmail(email);
    if (!record) throw new UnauthorizedError('Invalid credentials');

    const valid = await this.passwordService.compare(password, record.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    if (record.mfaEnabled) {
      const tempToken = this.tokenService.signMfaTemp(record.id);
      return { mfaRequired: true, tempToken };
    }

    const user = await this.userRepository.findById(record.id);
    const token = this.tokenService.signAccess(record.id);
    return { token, user: user.toPublic() };
  }
}

module.exports = LoginUseCase;
