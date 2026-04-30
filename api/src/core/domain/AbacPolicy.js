const { ForbiddenError } = require('./errors');

/**
 * Attribute-Based Access Control policy for the Product domain.
 * Pure domain logic — no I/O, no framework dependencies.
 *
 * Attributes evaluated:
 *   Subject  : user.roles, user.department, user.id
 *   Resource : product.department, product.ownerId, product.status
 */
class AbacPolicy {
  /**
   * @param {import('./User')} user
   * @param {'select'|'insert'|'update'|'delete'} action
   * @param {import('./Product')|null} product  — null when checking insert (no resource yet)
   * @returns {{ allow: boolean, reason: string, attributes: object }}
   */
  evaluateProduct(user, action, product = null) {
    const isAdmin = user.isAdmin();

    const attributes = {
      subject: { roles: user.roles, department: user.department, id: user.id },
      resource: product
        ? { department: product.department, ownerId: product.ownerId, status: product.status }
        : null,
      action,
    };

    let allow, reason;

    switch (action) {
      case 'select':
        if (isAdmin) {
          allow = true; reason = 'Subject has admin role → unrestricted read';
        } else if (!product) {
          allow = true; reason = `Listing allowed; results filtered to department = "${user.department}"`;
        } else if (product.department === user.department) {
          allow = true; reason = `subject.department "${user.department}" === resource.department "${product.department}"`;
        } else {
          allow = false; reason = `subject.department "${user.department}" ≠ resource.department "${product.department}"`;
        }
        break;

      case 'insert':
        if (isAdmin) {
          allow = true; reason = 'Subject has admin role → can create any product';
        } else if (user.department === 'sales') {
          allow = true; reason = 'subject.department "sales" satisfies insert policy';
        } else {
          allow = false; reason = `insert requires subject.department = "sales" or admin role (got "${user.department}")`;
        }
        break;

      case 'update':
        if (isAdmin) {
          allow = true; reason = 'Subject has admin role → can update any product';
        } else if (product && product.isOwnedBy(user.id)) {
          allow = true; reason = `subject.id ${user.id} === resource.ownerId ${product.ownerId}`;
        } else {
          allow = false; reason = 'update requires admin role OR subject.id === resource.ownerId';
        }
        break;

      case 'delete':
        if (isAdmin) {
          allow = true; reason = 'Subject has admin role → can delete any product';
        } else if (product && product.isOwnedBy(user.id) && product.isDraft()) {
          allow = true;
          reason = `subject.id === resource.ownerId AND resource.status "draft" satisfies delete policy`;
        } else if (product && product.isOwnedBy(user.id) && !product.isDraft()) {
          allow = false;
          reason = `subject.id === resource.ownerId but resource.status "${product.status}" ≠ "draft"`;
        } else {
          allow = false; reason = 'delete requires admin role OR (owner AND resource.status = "draft")';
        }
        break;

      default:
        allow = false; reason = `Unknown action "${action}"`;
    }

    return { allow, reason, attributes };
  }
}

module.exports = new AbacPolicy();
