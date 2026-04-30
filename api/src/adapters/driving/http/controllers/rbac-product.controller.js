const { NotFoundError } = require('../../../../core/domain/errors');

function makeRbacProductController({ productRepository }) {
  return {
    async list(req, res, next) {
      try {
        const products = await productRepository.findAll();
        res.json(products);
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        const product = await productRepository.create({
          ...req.body,
          ownerId: req.user.id,
          department: req.body.department || req.user.department,
        });
        res.status(201).json(product);
      } catch (err) { next(err); }
    },

    async update(req, res, next) {
      try {
        const existing = await productRepository.findById(Number(req.params.id));
        if (!existing) throw new NotFoundError('Product');
        const product = await productRepository.update(Number(req.params.id), req.body);
        res.json(product);
      } catch (err) { next(err); }
    },

    async remove(req, res, next) {
      try {
        const existing = await productRepository.findById(Number(req.params.id));
        if (!existing) throw new NotFoundError('Product');
        await productRepository.delete(Number(req.params.id));
        res.status(204).send();
      } catch (err) { next(err); }
    },
  };
}

module.exports = { makeRbacProductController };
