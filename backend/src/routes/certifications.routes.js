const router = require('express').Router();
const certificationsController = require('../controllers/certifications.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, certificationsController.listMine);

module.exports = router;
