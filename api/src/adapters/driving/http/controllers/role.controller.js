function makeRoleController({ roleService }) {
  return {
    async list(req, res, next) {
      try {
        res.json(await roleService.listRoles());
      } catch (err) { next(err); }
    },

    async get(req, res, next) {
      try {
        res.json(await roleService.getRole(Number(req.params.id)));
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        res.status(201).json(await roleService.createRole(req.body));
      } catch (err) { next(err); }
    },

    async update(req, res, next) {
      try {
        res.json(await roleService.updateRole(Number(req.params.id), req.body));
      } catch (err) { next(err); }
    },

    async remove(req, res, next) {
      try {
        await roleService.deleteRole(Number(req.params.id));
        res.status(204).send();
      } catch (err) { next(err); }
    },

    async listPermissions(req, res, next) {
      try {
        res.json(await roleService.listPermissions());
      } catch (err) { next(err); }
    },

    async assignPermission(req, res, next) {
      try {
        const role = await roleService.assignPermission(
          Number(req.params.id),
          Number(req.body.permissionId)
        );
        res.json(role);
      } catch (err) { next(err); }
    },

    async removePermission(req, res, next) {
      try {
        const role = await roleService.removePermission(
          Number(req.params.id),
          Number(req.params.permId)
        );
        res.json(role);
      } catch (err) { next(err); }
    },
  };
}

module.exports = { makeRoleController };
