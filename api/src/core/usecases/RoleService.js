const { NotFoundError, ConflictError } = require('../domain/errors');

class RoleService {
  constructor({ roleRepository }) {
    this.roleRepository = roleRepository;
  }

  async listRoles() {
    return this.roleRepository.findAll();
  }

  async getRole(id) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new NotFoundError('Role');
    return role;
  }

  async createRole({ name, description }) {
    const existing = await this.roleRepository.findByName(name);
    if (existing) throw new ConflictError(`Role "${name}" already exists`);
    return this.roleRepository.create({ name, description });
  }

  async updateRole(id, { name, description }) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new NotFoundError('Role');
    return this.roleRepository.update(id, { name, description });
  }

  async deleteRole(id) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new NotFoundError('Role');
    await this.roleRepository.delete(id);
  }

  async listPermissions() {
    return this.roleRepository.findAllPermissions();
  }

  async assignPermission(roleId, permId) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new NotFoundError('Role');
    const perm = await this.roleRepository.findPermissionById(permId);
    if (!perm) throw new NotFoundError('Permission');
    return this.roleRepository.assignPermission(roleId, permId);
  }

  async removePermission(roleId, permId) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new NotFoundError('Role');
    return this.roleRepository.removePermission(roleId, permId);
  }
}

module.exports = RoleService;
