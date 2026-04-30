const { UnauthorizedError } = require('../../domain/errors');

class VerifyMfaUseCase {
  constructor({ userRepository, tokenService, totpService }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.totpService = totpService;
  }

  async execute({ tempToken, code }) {
    const payload = this.tokenService.verifyMfaTemp(tempToken);
    if (!payload) throw new UnauthorizedError('Temp token invalid or expired');

    const record = await this.userRepository.findRawById(payload.sub);
    if (!record || !record.mfaSecret) throw new UnauthorizedError('MFA not configured');

    const valid = this.totpService.verify(code, record.mfaSecret);
    if (!valid) throw new UnauthorizedError('Invalid MFA code');

    const user = await this.userRepository.findById(record.id);
    const token = this.tokenService.signAccess(record.id);
    return { token, user: user.toPublic() };
  }
}

module.exports = VerifyMfaUseCase;
