const pool = require('../../../driven/persistence/db');

function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int as cnt
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1 AND p.resource = $2 AND p.action = $3
      `, [req.user.id, resource, action]);

      if (rows[0].cnt === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          reason: `Your role does not have '${action}' permission on '${resource}'`,
        });
      }
      next();
    } catch (err) { next(err); }
  };
}

module.exports = { requirePermission };
