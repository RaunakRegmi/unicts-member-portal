const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const validateRequest = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const {
  createEventSchema,
  updateEventSchema,
  rejectApplicationSchema,
  changeRoleSchema,
  changeStatusSchema,
  renewMemberSchema,
  sendNotificationSchema,
  createCertificationSchema,
  createNewsletterSchema,
  createCvTemplateSchema,
  commitImportSchema,
  listApplicationsQuerySchema,
  listMembersQuerySchema,
} = require('../validators/admin.validators');

router.use(authMiddleware, rbacMiddleware(['ADMIN', 'SUPER_ADMIN']));

router.get('/stats', adminController.getStats);

// Applications
router.get(
  '/applications',
  validateRequest(listApplicationsQuerySchema, 'query'),
  adminController.listApplications
);
router.get('/applications/:id', adminController.getApplication);
router.patch('/applications/:id/approve', adminController.approveApplication);
router.patch(
  '/applications/:id/reject',
  validateRequest(rejectApplicationSchema),
  adminController.rejectApplication
);

// Members
router.get(
  '/members',
  validateRequest(listMembersQuerySchema, 'query'),
  adminController.listMembers
);
// Bulk member registration: manual rows or Excel upload → preview with
// duplicate detection → commit (creates accounts + sends credentials).
// Registered before the /members/:id routes so "import" never matches :id.
router.post(
  '/members/import/preview',
  upload.single('file'),
  adminController.previewImport
);
router.post(
  '/members/import/commit',
  validateRequest(commitImportSchema),
  adminController.commitImport
);

router.get('/members/:id', adminController.getMember);
router.patch(
  '/members/:id/role',
  rbacMiddleware(['SUPER_ADMIN']),
  validateRequest(changeRoleSchema),
  adminController.changeRole
);
router.patch(
  '/members/:id/status',
  validateRequest(changeStatusSchema),
  adminController.changeStatus
);
router.post('/members/:id/reset-password', adminController.resetPassword);
router.patch(
  '/members/:id/renew',
  validateRequest(renewMemberSchema),
  adminController.renewMember
);
router.post(
  '/members/:id/certifications',
  upload.single('certificate'),
  validateRequest(createCertificationSchema),
  adminController.issueCertification
);

// Events
router.post(
  '/events',
  upload.single('banner'),
  validateRequest(createEventSchema),
  adminController.createEvent
);
router.patch(
  '/events/:id',
  upload.single('banner'),
  validateRequest(updateEventSchema),
  adminController.updateEvent
);
router.delete('/events/:id', adminController.deleteEvent);

// Newsletters
router.post(
  '/newsletters',
  upload.single('attachment'),
  validateRequest(createNewsletterSchema),
  adminController.createNewsletter
);

// CV templates
router.post(
  '/cv-templates',
  upload.single('preview'),
  validateRequest(createCvTemplateSchema),
  adminController.createCvTemplate
);

// SMS / Email / in-app blasts
router.post(
  '/notifications/send',
  validateRequest(sendNotificationSchema),
  adminController.sendNotifications
);

module.exports = router;
