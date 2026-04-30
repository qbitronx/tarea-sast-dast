require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Driven adapters — PostgreSQL repositories + services
const PgUserRepository    = require('./src/adapters/driven/persistence/PgUserRepository');
const PgRoleRepository    = require('./src/adapters/driven/persistence/PgRoleRepository');
const PgProductRepository = require('./src/adapters/driven/persistence/PgProductRepository');
const JwtTokenService         = require('./src/adapters/driven/services/JwtTokenService');
const BcryptPasswordService   = require('./src/adapters/driven/services/BcryptPasswordService');
const OtplibTotpService       = require('./src/adapters/driven/services/OtplibTotpService');

// Use-cases / application layer
const LoginUseCase      = require('./src/core/usecases/auth/LoginUseCase');
const VerifyMfaUseCase  = require('./src/core/usecases/auth/VerifyMfaUseCase');
const SetupMfaUseCase   = require('./src/core/usecases/auth/SetupMfaUseCase');
const EnableMfaUseCase  = require('./src/core/usecases/auth/EnableMfaUseCase');
const DisableMfaUseCase = require('./src/core/usecases/auth/DisableMfaUseCase');
const UserService    = require('./src/core/usecases/UserService');
const RoleService    = require('./src/core/usecases/RoleService');
const ProductService = require('./src/core/usecases/ProductService');

// Driving adapters — HTTP
const { makeAuthMiddleware }    = require('./src/adapters/driving/http/middleware/auth.middleware');
const { requirePermission }     = require('./src/adapters/driving/http/middleware/rbac.middleware');
const { makeAuthController }    = require('./src/adapters/driving/http/controllers/auth.controller');
const { makeUserController }    = require('./src/adapters/driving/http/controllers/user.controller');
const { makeRoleController }    = require('./src/adapters/driving/http/controllers/role.controller');
const { makeProductController }     = require('./src/adapters/driving/http/controllers/product.controller');
const { makeRbacProductController } = require('./src/adapters/driving/http/controllers/rbac-product.controller');
const { makeAuthRouter }        = require('./src/adapters/driving/http/routes/auth.routes');
const { makeUserRouter }        = require('./src/adapters/driving/http/routes/user.routes');
const { makeRoleRouter }        = require('./src/adapters/driving/http/routes/role.routes');
const { makeProductRouter }     = require('./src/adapters/driving/http/routes/product.routes');
const { makeRbacProductRouter } = require('./src/adapters/driving/http/routes/rbac-product.routes');

const { initSchema } = require('./src/adapters/driven/persistence/schema');
const { seed }       = require('./src/adapters/driven/persistence/seed');

async function createApp() {
  await initSchema();
  await seed();

  // ── Instantiate driven adapters ──────────────────────────────────────────
  const userRepository    = new PgUserRepository();
  const roleRepository    = new PgRoleRepository();
  const productRepository = new PgProductRepository();
  const tokenService      = new JwtTokenService();
  const passwordService   = new BcryptPasswordService();
  const totpService       = new OtplibTotpService();

  // ── Wire use-cases ───────────────────────────────────────────────────────
  const loginUseCase      = new LoginUseCase({ userRepository, passwordService, tokenService });
  const verifyMfaUseCase  = new VerifyMfaUseCase({ userRepository, tokenService, totpService });
  const setupMfaUseCase   = new SetupMfaUseCase({ userRepository, totpService });
  const enableMfaUseCase  = new EnableMfaUseCase({ userRepository, totpService });
  const disableMfaUseCase = new DisableMfaUseCase({ userRepository, totpService });

  const userService    = new UserService({ userRepository, roleRepository, passwordService });
  const roleService    = new RoleService({ roleRepository });
  const productService = new ProductService({ productRepository, userRepository });

  // ── Middleware ───────────────────────────────────────────────────────────
  const authenticate = makeAuthMiddleware({ userRepository, tokenService });

  // ── Controllers ──────────────────────────────────────────────────────────
  const authController    = makeAuthController({ loginUseCase, verifyMfaUseCase, setupMfaUseCase, enableMfaUseCase, disableMfaUseCase });
  const userController    = makeUserController({ userService });
  const roleController    = makeRoleController({ roleService });
  const productController     = makeProductController({ productService });
  const rbacProductController = makeRbacProductController({ productRepository });

  // ── Express app ──────────────────────────────────────────────────────────
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());

  app.use('/api/auth',     makeAuthRouter({ authController, authenticate }));
  app.use('/api/users',    makeUserRouter({ userController, authenticate, requirePermission }));
  app.use('/api/roles',    makeRoleRouter({ roleController, authenticate, requirePermission }));
  app.use('/api/products',      makeProductRouter({ productController, authenticate }));
  app.use('/api/rbac/products', makeRbacProductRouter({ rbacProductController, authenticate, requirePermission }));

  // ── Error handler ────────────────────────────────────────────────────────
  app.use((err, req, res, _next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    if (status === 500) console.error(err);
    res.status(status).json({ error: message, reason: err.reason });
  });

  return app;
}

module.exports = { createApp };
