const router = require('express').Router();
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const {
  updateProfileSchema,
  updateAddressSchema,
  updateEducationSchema,
  updateEmploymentSchema,
} = require('../validators/profile.validators');

router.use(authMiddleware);

router.get('/profile', profileController.getProfile);
router.patch('/profile', validateRequest(updateProfileSchema), profileController.updateProfile);
router.patch('/address', validateRequest(updateAddressSchema), profileController.updateAddress);
router.patch(
  '/education',
  validateRequest(updateEducationSchema),
  profileController.updateEducation
);
router.patch(
  '/employment',
  validateRequest(updateEmploymentSchema),
  profileController.updateEmployment
);
router.get('/completion', profileController.getCompletion);

router.post(
  '/profile-picture',
  upload.single('file'),
  profileController.uploadProfilePicture
);
// Accepts either a multipart file or a JSON body with a signature-pad dataUrl
router.post('/signature', upload.single('file'), profileController.uploadSignature);

router.get('/notifications', profileController.listNotifications);

module.exports = router;
