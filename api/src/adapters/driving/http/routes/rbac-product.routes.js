const { Router } = require('express');

function makeRbacProductRouter({ rbacProductController, authenticate, requirePermission }) {
  const router = Router();

  router.use(authenticate);

  router.get(   '/',     requirePermission('products', 'read'),   rbacProductController.list);
  router.post(  '/',     requirePermission('products', 'create'), rbacProductController.create);
  router.put(   '/:id',  requirePermission('products', 'update'), rbacProductController.update);
  router.delete('/:id',  requirePermission('products', 'delete'), rbacProductController.remove);

  return router;
}

module.exports = { makeRbacProductRouter };
