const multer = require('multer');

// Files land in memory and are pushed to object storage by the services —
// nothing is ever written to the app server's disk except in the explicit
// local-storage dev fallback. Real content-type sniffing happens in
// document.service via utils/mime before anything is stored.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
