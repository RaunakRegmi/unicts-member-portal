const router = require('express').Router();
const eventsController = require('../controllers/events.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', eventsController.list);
router.get('/:id', eventsController.detail);
router.post('/:id/rsvp', eventsController.rsvp);

module.exports = router;
