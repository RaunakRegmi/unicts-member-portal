const membershipService = require('../services/membership.service');
const paymentService = require('../services/payment.service');
const documentService = require('../services/document.service');

async function startApplication(req, res, next) {
  try {
    const application = await membershipService.startApplication(req.user.id, req.body);
    res.status(201).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

async function getMyApplication(req, res, next) {
  try {
    const result = await membershipService.getMyApplication(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function saveInstitutionalDetail(req, res, next) {
  try {
    const docUrls = {};
    const regDoc = req.files && req.files.businessRegistrationDoc;
    const vatDoc = req.files && req.files.vatOrPanDoc;
    if (regDoc && regDoc[0]) {
      docUrls.businessRegistrationDocUrl = await documentService.storeDocumentFile(
        regDoc[0],
        'institutional'
      );
    }
    if (vatDoc && vatDoc[0]) {
      docUrls.vatOrPanDocUrl = await documentService.storeDocumentFile(
        vatDoc[0],
        'institutional'
      );
    }
    const detail = await membershipService.saveInstitutionalDetail(
      req.user.id,
      req.body,
      docUrls
    );
    res.status(200).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

async function submitApplication(req, res, next) {
  try {
    const application = await membershipService.submitApplication(req.user.id);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    const payment = await paymentService.recordPayment(req.user.id);
    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

async function renew(req, res, next) {
  try {
    const application = await membershipService.renewOwnMembership(req.user.id);
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startApplication,
  getMyApplication,
  saveInstitutionalDetail,
  submitApplication,
  recordPayment,
  renew,
};
