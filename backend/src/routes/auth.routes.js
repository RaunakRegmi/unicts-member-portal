const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');
const {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validators');

const byIdentifier = (req) => (req.body && req.body.identifier) || req.ip;

router.post(
  '/signup',
  rateLimiter({ prefix: 'signup', windowSec: 3600, max: 10 }),
  validateRequest(signupSchema),
  authController.signup
);

router.post(
  '/verify-otp',
  rateLimiter({ prefix: 'verify-otp', windowSec: 600, max: 20, keyFn: byIdentifier }),
  validateRequest(verifyOtpSchema),
  authController.verifyOtp
);

// 60-second resend cooldown per identifier, per the spec
router.post(
  '/resend-otp',
  rateLimiter({ prefix: 'resend-otp', windowSec: 60, max: 1, keyFn: byIdentifier }),
  rateLimiter({ prefix: 'resend-otp-hourly', windowSec: 3600, max: 6, keyFn: byIdentifier }),
  validateRequest(resendOtpSchema),
  authController.resendOtp
);

router.post(
  '/login',
  rateLimiter({ prefix: 'login', windowSec: 300, max: 15 }),
  validateRequest(loginSchema),
  authController.login
);

router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware, authController.logout);

router.post(
  '/forgot-password',
  rateLimiter({ prefix: 'forgot', windowSec: 900, max: 5, keyFn: byIdentifier }),
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  rateLimiter({ prefix: 'reset', windowSec: 900, max: 10, keyFn: byIdentifier }),
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

router.get('/me', authMiddleware, authController.me);

module.exports = router;
