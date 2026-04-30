const User = require('../../../core/domain/User');
const pool = require('./db');

class PgUserRepository {
  _toEntity(row) {
    if (!row) return null;
    return new User({
      id: row.id,
      email: row.email,
      department: row.department,
      mfaEnabled: row.mfa_enabled,
      roles: row.roles ? row.roles.split(',') : [],
    });
  }

  _toAuthRecord(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      department: row.department,
    };
  }

  async findAll() {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.department, u.mfa_enabled,
             STRING_AGG(r.name, ',' ORDER BY r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.id
    `);
    return rows.map((r) => this._toEntity(r));
  }

  async findById(id) {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.department, u.mfa_enabled,
             STRING_AGG(r.name, ',' ORDER BY r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [id]);
    return this._toEntity(rows[0]);
  }

  async findRawById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return this._toAuthRecord(rows[0]);
  }

  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return this._toAuthRecord(rows[0]);
  }

  async create({ email, passwordHash, department }) {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, department) VALUES ($1, $2, $3) RETURNING id',
      [email, passwordHash, department]
    );
    return this.findById(rows[0].id);
  }

  async update(id, { email, department, passwordHash }) {
    await pool.query(
      `UPDATE users
       SET email         = COALESCE($1, email),
           department    = COALESCE($2, department),
           password_hash = COALESCE($3, password_hash)
       WHERE id = $4`,
      [email ?? null, department ?? null, passwordHash ?? null, id]
    );
    return this.findById(id);
  }

  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async assignRole(userId, roleId) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId]
    );
  }

  async removeRole(userId, roleId) {
    await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
  }

  async updateMfaSecret(userId, secret) {
    await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, userId]);
  }

  async setMfaEnabled(userId, enabled) {
    if (enabled) {
      await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [userId]);
    } else {
      await pool.query('UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1', [userId]);
    }
  }
}

module.exports = PgUserRepository;
