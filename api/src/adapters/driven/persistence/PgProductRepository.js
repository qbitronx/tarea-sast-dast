const Product = require('../../../core/domain/Product');
const pool = require('./db');

class PgProductRepository {
  _toEntity(row) {
    if (!row) return null;
    return new Product({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      ownerId: row.owner_id,
      department: row.department,
      price: Number(row.price),
      createdAt: row.created_at,
    });
  }

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
    return rows.map((r) => this._toEntity(r));
  }

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return this._toEntity(rows[0]);
  }

  async create({ name, description, status = 'draft', ownerId, department, price = 0 }) {
    const { rows } = await pool.query(`
      INSERT INTO products (name, description, status, owner_id, department, price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [name, description || null, status, ownerId, department, price]);
    return this.findById(rows[0].id);
  }

  async update(id, { name, description, status, price }) {
    await pool.query(`
      UPDATE products
      SET name        = COALESCE($1, name),
          description = COALESCE($2, description),
          status      = COALESCE($3, status),
          price       = COALESCE($4, price)
      WHERE id = $5
    `, [name ?? null, description ?? null, status ?? null, price ?? null, id]);
    return this.findById(id);
  }

  async delete(id) {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
  }
}

module.exports = PgProductRepository;
