const pool = require('./db');

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      mfa_secret    TEXT,
      mfa_enabled   BOOLEAN DEFAULT false,
      department    TEXT DEFAULT 'general',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS roles (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id       SERIAL PRIMARY KEY,
      resource TEXT NOT NULL,
      action   TEXT NOT NULL,
      UNIQUE(resource, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'draft',
      owner_id    INTEGER REFERENCES users(id),
      department  TEXT NOT NULL,
      price       NUMERIC(10,2) DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { initSchema };
