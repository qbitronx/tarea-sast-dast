const pool = require('./db');

class PgRoleRepository {
  async _withPermissions(role) {
    const { rows } = await pool.query(`
      SELECT p.id, p.resource, p.action
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.resource, p.action
    `, [role.id]);
    return { ...role, permissions: rows };
  }

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM roles ORDER BY id');
    return Promise.all(rows.map((r) => this._withPermissions(r)));
  }

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this._withPermissions(rows[0]);
  }

  async findByName(name) {
    const { rows } = await pool.query('SELECT * FROM roles WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async create({ name, description }) {
    const { rows } = await pool.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
      [name, description || null]
    );
    return this.findById(rows[0].id);
  }

  async update(id, { name, description }) {
    await pool.query(
      'UPDATE roles SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3',
      [name ?? null, description ?? null, id]
    );
    return this.findById(id);
  }

  async delete(id) {
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  }

  async findAllPermissions() {
    const { rows } = await pool.query('SELECT * FROM permissions ORDER BY resource, action');
    return rows;
  }

  async findPermissionById(permId) {
    const { rows } = await pool.query('SELECT * FROM permissions WHERE id = $1', [permId]);
    return rows[0] || null;
  }

  async assignPermission(roleId, permId) {
    await pool.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, permId]
    );
    return this.findById(roleId);
  }

  async removePermission(roleId, permId) {
    await pool.query(
      'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
      [roleId, permId]
    );
    return this.findById(roleId);
  }
}

module.exports = PgRoleRepository;
