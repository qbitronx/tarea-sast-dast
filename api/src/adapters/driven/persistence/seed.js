const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int as count FROM users');
  if (rows[0].count > 0) return;

  await pool.query(`INSERT INTO roles (name, description) VALUES
    ('admin',  'Full system access'),
    ('editor', 'Can create and edit content'),
    ('viewer', 'Read-only access')
    ON CONFLICT (name) DO NOTHING`);

  const resources = ['users', 'roles', 'products'];
  const actions   = ['create', 'read', 'update', 'delete'];
  for (const resource of resources) {
    for (const action of actions) {
      await pool.query(
        'INSERT INTO permissions (resource, action) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [resource, action]
      );
    }
  }

  const roleId = async (name) => {
    const { rows } = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
    return rows[0].id;
  };
  const permId = async (r, a) => {
    const { rows } = await pool.query('SELECT id FROM permissions WHERE resource = $1 AND action = $2', [r, a]);
    return rows[0].id;
  };

  const adminId  = await roleId('admin');
  const editorId = await roleId('editor');
  const viewerId = await roleId('viewer');

  for (const resource of resources) {
    for (const action of actions) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [adminId, await permId(resource, action)]
      );
    }
  }
  for (const action of ['create', 'read', 'update']) {
    await pool.query(
      'INSERT INTO role_permissions VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [editorId, await permId('products', action)]
    );
  }
  await pool.query('INSERT INTO role_permissions VALUES ($1, $2) ON CONFLICT DO NOTHING', [editorId, await permId('users', 'read')]);
  await pool.query('INSERT INTO role_permissions VALUES ($1, $2) ON CONFLICT DO NOTHING', [editorId, await permId('roles', 'read')]);
  for (const resource of resources) {
    await pool.query('INSERT INTO role_permissions VALUES ($1, $2) ON CONFLICT DO NOTHING', [viewerId, await permId(resource, 'read')]);
  }

  const insertUser = async (email, password, dept) => {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, department) VALUES ($1, $2, $3) RETURNING id',
      [email, hash, dept]
    );
    return rows[0].id;
  };

  const adminUid = await insertUser('admin@demo.com', 'Admin123!', 'it');
  const aliceUid = await insertUser('alice@demo.com', 'Alice123!', 'sales');
  const bobUid   = await insertUser('bob@demo.com',   'Bob123!',   'marketing');

  await pool.query('INSERT INTO user_roles VALUES ($1, $2)', [adminUid, adminId]);
  await pool.query('INSERT INTO user_roles VALUES ($1, $2)', [aliceUid, editorId]);
  await pool.query('INSERT INTO user_roles VALUES ($1, $2)', [bobUid,   viewerId]);

  const insertProduct = async (name, desc, status, ownerId, dept, price) => {
    await pool.query(
      'INSERT INTO products (name, description, status, owner_id, department, price) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, desc, status, ownerId, dept, price]
    );
  };
  await insertProduct('Product Alpha', 'First demo product',  'draft',     aliceUid, 'sales',     99.99);
  await insertProduct('Product Beta',  'Second demo product', 'published', aliceUid, 'sales',     149.99);
  await insertProduct('Product Gamma', 'Marketing product',   'draft',     bobUid,   'marketing', 49.99);

  console.log('✓ Database seeded');
}

module.exports = { seed };
