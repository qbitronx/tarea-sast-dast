const { authenticator } = require('otplib');
const QRCode = require('qrcode');

class OtplibTotpService {
  generateSecret() {
    return authenticator.generateSecret();
  }

  async generateQrCode(email, secret) {
    const otpUri = authenticator.keyuri(email, 'SecurityDemo', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpUri);
    return { otpUri, qrCodeUrl };
  }

  verify(token, secret) {
    return authenticator.verify({ token, secret });
  }
}

module.exports = OtplibTotpService;
