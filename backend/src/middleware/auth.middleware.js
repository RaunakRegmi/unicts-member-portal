const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/errors');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized());

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Session expired or invalid', 'TOKEN_INVALID'));
  }
}

module.exports = authMiddleware;
