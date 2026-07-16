const router = require('express').Router();
const membershipController = require('../controllers/membership.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const {
  startApplicationSchema,
  institutionalDetailSchema,
} = require('../validators/membership.validators');

router.use(authMiddleware);

router.post(
  '/application',
  validateRequest(startApplicationSchema),
  membershipController.startApplication
);
router.get('/application', membershipController.getMyApplication);

router.patch(
  '/application/institutional-detail',
  upload.fields([
    { name: 'businessRegistrationDoc', maxCount: 1 },
    { name: 'vatOrPanDoc', maxCount: 1 },
  ]),
  validateRequest(institutionalDetailSchema),
  membershipController.saveInstitutionalDetail
);

router.post('/application/submit', membershipController.submitApplication);
router.post('/application/payment', membershipController.recordPayment);
router.post('/application/renew', membershipController.renew);

module.exports = router;
