class User {
  constructor({ id, email, department, mfaEnabled, roles = [] }) {
    this.id = id;
    this.email = email;
    this.department = department;
    this.mfaEnabled = Boolean(mfaEnabled);
    this.roles = roles;
  }

  isAdmin() {
    return this.roles.includes('admin');
  }

  hasRole(roleName) {
    return this.roles.includes(roleName);
  }

  toPublic() {
    return {
      id: this.id,
      email: this.email,
      department: this.department,
      mfaEnabled: this.mfaEnabled,
      roles: this.roles,
    };
  }
}

module.exports = User;
