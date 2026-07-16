const router = require('express').Router();
const idcardController = require('../controllers/idcard.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', idcardController.getMine);
router.get('/download', idcardController.download);

module.exports = router;
