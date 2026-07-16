const router = require('express').Router();
const cvController = require('../controllers/cv.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const { parseCvSchema, generateCvSchema } = require('../validators/cv.validators');

router.use(authMiddleware);

router.get('/', cvController.listMine);
router.post('/upload', upload.single('file'), cvController.upload);
router.post('/parse', validateRequest(parseCvSchema), cvController.parse);
router.post('/generate', validateRequest(generateCvSchema), cvController.generate);

module.exports = router;
