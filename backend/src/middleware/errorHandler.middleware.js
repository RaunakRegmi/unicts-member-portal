const config = require('../config/env');
const { ApiError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5MB)' : err.message;
    return res
      .status(400)
      .json({ success: false, error: { code: 'UPLOAD_ERROR', message } });
  }

  // Prisma unique-constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with that value already exists' },
    });
  }
  // Prisma record-not-found (update/delete on missing row)
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  }

  console.error('[error]', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL',
      message: config.isDev ? err.message : 'Something went wrong',
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

module.exports = { errorHandler, notFoundHandler };
