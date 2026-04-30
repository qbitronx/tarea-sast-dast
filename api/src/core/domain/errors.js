class DomainError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}

class NotFoundError extends DomainError {
  constructor(resource) {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends DomainError {
  constructor(reason = 'Forbidden') {
    super(reason, 403);
    this.name = 'ForbiddenError';
    this.reason = reason;
  }
}

class ConflictError extends DomainError {
  constructor(message) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

module.exports = { DomainError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError };
