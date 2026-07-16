const { ApiError } = require('../utils/errors');

const rbacMiddleware = (roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Your role does not permit this action'));
  }
  return next();
};

module.exports = rbacMiddleware;
