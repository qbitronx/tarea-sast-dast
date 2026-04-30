class SetupMfaUseCase {
  constructor({ userRepository, totpService }) {
    this.userRepository = userRepository;
    this.totpService = totpService;
  }

  async execute({ userId, email }) {
    const secret = this.totpService.generateSecret();
    const { otpUri, qrCodeUrl } = await this.totpService.generateQrCode(email, secret);

    await this.userRepository.updateMfaSecret(userId, secret);
    return { secret, otpUri, qrCodeUrl };
  }
}

module.exports = SetupMfaUseCase;
