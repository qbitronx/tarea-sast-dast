const { ForbiddenError } = require('../../../../core/domain/errors');

function makeProductController({ productService }) {
  return {
    async list(req, res, next) {
      try {
        const result = await productService.listProducts(req.user);
        res.json(result);
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        const result = await productService.createProduct(req.user, req.body);
        res.status(201).json(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return res.status(403).json({ error: err.message, reason: err.reason || err.message });
        }
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const result = await productService.updateProduct(req.user, Number(req.params.id), req.body);
        res.json(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return res.status(403).json({ error: err.message, reason: err.reason || err.message });
        }
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        const result = await productService.deleteProduct(req.user, Number(req.params.id));
        res.json(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return res.status(403).json({ error: err.message, reason: err.reason || err.message });
        }
        next(err);
      }
    },

    async abacPreview(req, res, next) {
      try {
        const preview = await productService.getAbacPreview(req.user);
        res.json(preview);
      } catch (err) { next(err); }
    },
  };
}

module.exports = { makeProductController };
