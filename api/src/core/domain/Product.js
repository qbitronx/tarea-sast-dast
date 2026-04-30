class Product {
  constructor({ id, name, description, status, ownerId, department, price, createdAt }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.status = status;
    this.ownerId = ownerId;
    this.department = department;
    this.price = price;
    this.createdAt = createdAt;
  }

  isOwnedBy(userId) {
    return this.ownerId === userId;
  }

  isDraft() {
    return this.status === 'draft';
  }
}

module.exports = Product;
