const { Router } = require('express');

function makeAuthRouter({ authController, authenticate }) {
  const router = Router();

  router.post('/login',       authController.login);
  router.post('/mfa/verify',  authController.verifyMfa);
  router.get( '/mfa/setup',   authenticate, authController.setupMfa);
  router.post('/mfa/enable',  authenticate, authController.enableMfa);
  router.post('/mfa/disable', authenticate, authController.disableMfa);
  router.get( '/me',          authenticate, authController.me);

  // [DEMO] VULNERABILIDAD INTENCIONAL — Remote Code Execution (RCE)
  // Severidad: CRITICAL | CWE-94: Improper Control of Code Generation
  // eval() ejecuta directamente el input del usuario como código JavaScript.
  // Permite a un atacante correr cualquier instrucción en el servidor:
  //   GET /api/auth/debug/eval?expr=process.env
  //   GET /api/auth/debug/eval?expr=require('fs').readFileSync('/etc/passwd','utf8')
  // Detectado por: ESLint (no-eval), SonarQube (S1523 — Dynamically executing code)
  router.get('/debug/eval', (req, res) => {
    const result = eval(req.query.expr);
    res.json({ result });
  });

  return router;
}

module.exports = { makeAuthRouter };
