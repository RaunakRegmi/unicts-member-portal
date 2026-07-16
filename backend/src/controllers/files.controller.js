const path = require('path');
const config = require('../config/env');
const storageService = require('../services/storage.service');
const { EXTENSION_CONTENT_TYPES } = require('../utils/mime');
const { ApiError } = require('../utils/errors');

// Serves objects from the local-storage dev fallback via HMAC-signed URLs.
// When S3 is configured, downloads use presigned S3 URLs and this route 404s.
function serve(req, res, next) {
  try {
    if (!storageService.isLocalMode()) throw ApiError.notFound();

    const key = decodeURIComponent(req.params[0] || '');
    if (!key || key.includes('..')) throw ApiError.badRequest('Invalid file key');

    const { exp, sig } = req.query;
    if (!storageService.verifyLocalSignature(key, exp, sig)) {
      throw ApiError.forbidden('This link has expired — request a fresh one', 'LINK_EXPIRED');
    }

    const contentType =
      EXTENSION_CONTENT_TYPES[path.extname(key).toLowerCase()] ||
      'application/octet-stream';
    res.sendFile(path.resolve(config.uploadsDir, key), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { serve };
