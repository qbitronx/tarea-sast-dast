function makeAuthController({ loginUseCase, verifyMfaUseCase, setupMfaUseCase, enableMfaUseCase, disableMfaUseCase }) {
  return {
    async login(req, res, next) {
      try {
        const result = await loginUseCase.execute(req.body);
        res.json(result);
      } catch (err) { next(err); }
    },

    async verifyMfa(req, res, next) {
      try {
        const result = await verifyMfaUseCase.execute(req.body);
        res.json(result);
      } catch (err) { next(err); }
    },

    async setupMfa(req, res, next) {
      try {
        const result = await setupMfaUseCase.execute({ userId: req.user.id, email: req.user.email });
        res.json(result);
      } catch (err) { next(err); }
    },

    async enableMfa(req, res, next) {
      try {
        const result = await enableMfaUseCase.execute({ userId: req.user.id, code: req.body.code });
        res.json(result);
      } catch (err) { next(err); }
    },

    async disableMfa(req, res, next) {
      try {
        const result = await disableMfaUseCase.execute({ userId: req.user.id, code: req.body.code });
        res.json(result);
      } catch (err) { next(err); }
    },

    async me(req, res) {
      res.json({ user: req.user.toPublic() });
    },
  };
}

module.exports = { makeAuthController };
