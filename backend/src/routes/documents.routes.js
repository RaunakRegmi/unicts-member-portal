const router = require('express').Router();
const documentsController = require('../controllers/documents.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const { uploadDocumentSchema } = require('../validators/document.validators');

router.use(authMiddleware);

router.post(
  '/',
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
  ]),
  validateRequest(uploadDocumentSchema),
  documentsController.upload
);
router.get('/', documentsController.list);
router.delete('/:id', documentsController.remove);

module.exports = router;
