const router = require('express').Router();
const cvController = require('../controllers/cv.controller');

// Public per the spec — template previews are shown before signup completes
router.get('/', cvController.listTemplates);

module.exports = router;
