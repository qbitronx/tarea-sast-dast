const bcrypt = require('bcryptjs');

class BcryptPasswordService {
  async hash(plain) {
    return bcrypt.hash(plain, 10);
  }

  async compare(plain, hashed) {
    return bcrypt.compare(plain, hashed);
  }
}

module.exports = BcryptPasswordService;
