const jwt = require('jsonwebtoken');

class JwtTokenService {
  signAccess(userId) {
    return jwt.sign({ sub: userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  }

  signMfaTemp(userId) {
    return jwt.sign({ sub: userId, type: 'mfa' }, process.env.JWT_MFA_SECRET, { expiresIn: '5m' });
  }

  verifyAccess(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.type === 'access' ? payload : null;
    } catch {
      return null;
    }
  }

  verifyMfaTemp(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_MFA_SECRET);
      return payload.type === 'mfa' ? payload : null;
    } catch {
      return null;
    }
  }
}

module.exports = JwtTokenService;
