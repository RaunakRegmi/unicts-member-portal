const router = require('express').Router();
const referenceController = require('../controllers/reference.controller');

// Public reference data: Nepal administrative divisions for the cascading
// address selects, plus admin-manageable lookup tables.
router.get('/address-data', referenceController.addressData);
router.get('/ict-domains', referenceController.ictDomains);
router.get('/membership-groups', referenceController.membershipGroups);

module.exports = router;
