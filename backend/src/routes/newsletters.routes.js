const router = require('express').Router();
const newslettersController = require('../controllers/newsletters.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', newslettersController.list);
router.get('/:id', newslettersController.detail);

module.exports = router;
