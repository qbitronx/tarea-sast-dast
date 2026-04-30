function makeUserController({ userService }) {
  return {
    async list(req, res, next) {
      try {
        const users = await userService.listUsers();
        res.json(users.map((u) => u.toPublic()));
      } catch (err) { next(err); }
    },

    async get(req, res, next) {
      try {
        const user = await userService.getUser(Number(req.params.id));
        res.json(user.toPublic());
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        const user = await userService.createUser(req.body);
        res.status(201).json(user.toPublic());
      } catch (err) { next(err); }
    },

    async update(req, res, next) {
      try {
        const user = await userService.updateUser(Number(req.params.id), req.body);
        res.json(user.toPublic());
      } catch (err) { next(err); }
    },

    async remove(req, res, next) {
      try {
        await userService.deleteUser(Number(req.params.id));
        res.status(204).send();
      } catch (err) { next(err); }
    },

    async getRoles(req, res, next) {
      try {
        const roles = await userService.getUserRoles(Number(req.params.id));
        res.json(roles);
      } catch (err) { next(err); }
    },

    async assignRole(req, res, next) {
      try {
        const user = await userService.assignRole(Number(req.params.id), Number(req.body.roleId));
        res.json(user.toPublic());
      } catch (err) { next(err); }
    },

    async removeRole(req, res, next) {
      try {
        await userService.removeRole(Number(req.params.id), Number(req.params.roleId));
        res.status(204).send();
      } catch (err) { next(err); }
    },
  };
}

module.exports = { makeUserController };
