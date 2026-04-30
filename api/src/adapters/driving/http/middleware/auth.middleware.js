const { UnauthorizedError } = require('../../../../core/domain/errors');

function makeAuthMiddleware({ userRepository, tokenService }) {
  return async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = header.slice(7);
    const payload = tokenService.verifyAccess(token);
    if (!payload) return res.status(401).json({ error: 'Token invalid or expired' });

    const user = await userRepository.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  };
}

module.exports = { makeAuthMiddleware };
