const router = require('express').Router();
const calendarController = require('../controllers/calendar.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public: Google's OAuth redirect carries no Authorization header — the
// signed `state` token proves which member started the flow.
router.get('/callback', calendarController.callback);

router.get('/auth-url', authMiddleware, calendarController.getAuthUrl);
router.get('/status', authMiddleware, calendarController.status);
router.post('/sync', authMiddleware, calendarController.sync);

module.exports = router;
