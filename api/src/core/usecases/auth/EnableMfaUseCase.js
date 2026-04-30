const { DomainError, UnauthorizedError } = require('../../domain/errors');

class EnableMfaUseCase {
  constructor({ userRepository, totpService }) {
    this.userRepository = userRepository;
    this.totpService = totpService;
  }

  async execute({ userId, code }) {
    const record = await this.userRepository.findRawById(userId);
    if (!record.mfaSecret) throw new DomainError('Run /mfa/setup first');

    const valid = this.totpService.verify(code, record.mfaSecret);
    if (!valid) throw new UnauthorizedError('Invalid MFA code');

    await this.userRepository.setMfaEnabled(userId, true);
    return { message: 'MFA enabled successfully' };
  }
}

module.exports = EnableMfaUseCase;
