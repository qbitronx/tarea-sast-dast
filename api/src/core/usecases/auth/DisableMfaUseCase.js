const { DomainError, UnauthorizedError } = require('../../domain/errors');

class DisableMfaUseCase {
  constructor({ userRepository, totpService }) {
    this.userRepository = userRepository;
    this.totpService = totpService;
  }

  async execute({ userId, code }) {
    const record = await this.userRepository.findRawById(userId);
    if (!record.mfaEnabled) throw new DomainError('MFA is not enabled');

    const valid = this.totpService.verify(code, record.mfaSecret);
    if (!valid) throw new UnauthorizedError('Invalid MFA code');

    await this.userRepository.setMfaEnabled(userId, false);
    await this.userRepository.updateMfaSecret(userId, null);
    return { message: 'MFA disabled successfully' };
  }
}

module.exports = DisableMfaUseCase;
