const { Router } = require('express');

function makeProductRouter({ productController, authenticate }) {
  const router = Router();

  router.use(authenticate);

  router.get(   '/abac-preview', productController.abacPreview);
  router.get(   '/',             productController.list);
  router.post(  '/',             productController.create);
  router.put(   '/:id',          productController.update);
  router.delete('/:id',          productController.remove);

  return router;
}

module.exports = { makeProductRouter };
