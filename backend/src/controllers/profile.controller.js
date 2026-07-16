const kycService = require('../services/kyc.service');
const membershipService = require('../services/membership.service');
const notificationService = require('../services/notification.service');
const { ApiError } = require('../utils/errors');

async function getProfile(req, res, next) {
  try {
    const profile = await kycService.getProfile(req.user.id);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await kycService.updateProfile(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const result = await kycService.updateAddress(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function updateEducation(req, res, next) {
  try {
    const result = await kycService.updateEducation(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function updateEmployment(req, res, next) {
  try {
    const result = await kycService.updateEmployment(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getCompletion(req, res, next) {
  try {
    const completion = await membershipService.getCompletionBreakdown(req.user.id);
    res.status(200).json({ success: true, data: completion });
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePicture(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Attach an image file', 'MISSING_FILE');
    const result = await kycService.setProfilePicture(req.user.id, req.file);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function uploadSignature(req, res, next) {
  try {
    const result = await kycService.setSignature(req.user.id, {
      file: req.file,
      dataUrl: req.body && req.body.dataUrl,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listNotifications(req, res, next) {
  try {
    const notifications = await notificationService.listForUser(req.user.id);
    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateAddress,
  updateEducation,
  updateEmployment,
  getCompletion,
  uploadProfilePicture,
  uploadSignature,
  listNotifications,
};
