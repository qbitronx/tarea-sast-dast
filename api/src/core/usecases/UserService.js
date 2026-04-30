const { NotFoundError, ConflictError } = require('../domain/errors');

class UserService {
  /** @param {{ userRepository, roleRepository, passwordService }} ports */
  constructor({ userRepository, roleRepository, passwordService }) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.passwordService = passwordService;
  }

  async listUsers() {
    return this.userRepository.findAll();
  }

  async getUser(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async createUser({ email, password, department, roleIds = [] }) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new ConflictError('Email already in use');

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.userRepository.create({ email, passwordHash, department });

    for (const roleId of roleIds) {
      await this.userRepository.assignRole(user.id, roleId);
    }

    return this.userRepository.findById(user.id);
  }

  async updateUser(id, { email, department, password }) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    let passwordHash;
    if (password) passwordHash = await this.passwordService.hash(password);
    return this.userRepository.update(id, { email, department, passwordHash });
  }

  async deleteUser(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    await this.userRepository.delete(id);
  }

  async getUserRoles(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    return user.roles;
  }

  async assignRole(userId, roleId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new NotFoundError('Role');
    await this.userRepository.assignRole(userId, roleId);
    return this.userRepository.findById(userId);
  }

  async removeRole(userId, roleId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    await this.userRepository.removeRole(userId, roleId);
  }
}

module.exports = UserService;
