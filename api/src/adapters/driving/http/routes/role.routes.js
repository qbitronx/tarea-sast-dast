const { Router } = require('express');

function makeRoleRouter({ roleController, authenticate, requirePermission }) {
  const router = Router();

  router.use(authenticate);

  router.get(   '/permissions',              requirePermission('roles', 'read'),   roleController.listPermissions);
  router.get(   '/',                         requirePermission('roles', 'read'),   roleController.list);
  router.post(  '/',                         requirePermission('roles', 'create'), roleController.create);
  router.get(   '/:id',                      requirePermission('roles', 'read'),   roleController.get);
  router.put(   '/:id',                      requirePermission('roles', 'update'), roleController.update);
  router.delete('/:id',                      requirePermission('roles', 'delete'), roleController.remove);
  router.post(  '/:id/permissions',          requirePermission('roles', 'update'), roleController.assignPermission);
  router.delete('/:id/permissions/:permId',  requirePermission('roles', 'update'), roleController.removePermission);

  return router;
}

module.exports = { makeRoleRouter };
