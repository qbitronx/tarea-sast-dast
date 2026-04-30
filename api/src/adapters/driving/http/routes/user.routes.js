const { Router } = require('express');

function makeUserRouter({ userController, authenticate, requirePermission }) {
  const router = Router();

  router.use(authenticate);

  router.get(   '/',                      requirePermission('users', 'read'),   userController.list);
  router.post(  '/',                      requirePermission('users', 'create'), userController.create);
  router.get(   '/:id',                   requirePermission('users', 'read'),   userController.get);
  router.put(   '/:id',                   requirePermission('users', 'update'), userController.update);
  router.delete('/:id',                   requirePermission('users', 'delete'), userController.remove);
  router.get(   '/:id/roles',             requirePermission('users', 'read'),   userController.getRoles);
  router.post(  '/:id/roles',             requirePermission('users', 'update'), userController.assignRole);
  router.delete('/:id/roles/:roleId',     requirePermission('users', 'update'), userController.removeRole);

  return router;
}

module.exports = { makeUserRouter };
