const { NotFoundError, ForbiddenError } = require('../domain/errors');
const abacPolicy = require('../domain/AbacPolicy');

class ProductService {
  /** @param {{ productRepository, userRepository }} ports */
  constructor({ productRepository, userRepository }) {
    this.productRepository = productRepository;
    this.userRepository = userRepository;
  }

  async listProducts(user) {
    const evaluation = abacPolicy.evaluateProduct(user, 'select');
    const products = await this.productRepository.findAll();

    const filtered = user.isAdmin()
      ? products
      : products.filter((p) => p.department === user.department);

    return { products: filtered, evaluation };
  }

  async createProduct(user, data) {
    const evaluation = abacPolicy.evaluateProduct(user, 'insert');
    if (!evaluation.allow) throw new ForbiddenError(evaluation.reason);

    const product = await this.productRepository.create({
      ...data,
      ownerId: user.id,
      department: data.department || user.department,
    });
    return { product, evaluation };
  }

  async updateProduct(user, productId, data) {
    const existing = await this.productRepository.findById(productId);
    if (!existing) throw new NotFoundError('Product');

    const evaluation = abacPolicy.evaluateProduct(user, 'update', existing);
    if (!evaluation.allow) throw new ForbiddenError(evaluation.reason);

    const product = await this.productRepository.update(productId, data);
    return { product, evaluation };
  }

  async deleteProduct(user, productId) {
    const existing = await this.productRepository.findById(productId);
    if (!existing) throw new NotFoundError('Product');

    const evaluation = abacPolicy.evaluateProduct(user, 'delete', existing);
    if (!evaluation.allow) throw new ForbiddenError(evaluation.reason);

    await this.productRepository.delete(productId);
    return { evaluation };
  }

  async getAbacPreview(user) {
    const products = await this.productRepository.findAll();
    return products.map((p) => ({
      product: p,
      policies: {
        select: abacPolicy.evaluateProduct(user, 'select', p),
        update: abacPolicy.evaluateProduct(user, 'update', p),
        delete: abacPolicy.evaluateProduct(user, 'delete', p),
      },
    }));
  }
}

module.exports = ProductService;
