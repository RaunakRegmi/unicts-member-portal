const adminService = require('../services/admin.service');
const eventService = require('../services/event.service');
const newsletterService = require('../services/newsletter.service');
const certificationService = require('../services/certification.service');
const memberImportService = require('../services/memberImport.service');

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

const getStats = wrap(async (req, res) => {
  res.json({ success: true, data: await adminService.getStats() });
});

const listApplications = wrap(async (req, res) => {
  res.json({ success: true, data: await adminService.listApplications(req.query) });
});

const getApplication = wrap(async (req, res) => {
  res.json({ success: true, data: await adminService.getApplication(req.params.id) });
});

const approveApplication = wrap(async (req, res) => {
  const application = await adminService.approveApplication(req.params.id, req.user.id);
  res.json({ success: true, data: application });
});

const rejectApplication = wrap(async (req, res) => {
  const application = await adminService.rejectApplication(
    req.params.id,
    req.user.id,
    req.body.reason
  );
  res.json({ success: true, data: application });
});

const listMembers = wrap(async (req, res) => {
  res.json({ success: true, data: await adminService.listMembers(req.query) });
});

const getMember = wrap(async (req, res) => {
  res.json({ success: true, data: await adminService.getMember(req.params.id) });
});

const changeRole = wrap(async (req, res) => {
  const result = await adminService.changeRole(req.user.id, req.params.id, req.body.role);
  res.json({ success: true, data: result });
});

const changeStatus = wrap(async (req, res) => {
  const result = await adminService.changeStatus(
    req.user.id,
    req.params.id,
    req.body.status
  );
  res.json({ success: true, data: result });
});

// Accepts either an uploaded .xlsx (multipart `file`) or a JSON `users` array
const previewImport = wrap(async (req, res) => {
  const result = await memberImportService.preview({
    users: req.body && req.body.users,
    fileBuffer: req.file ? req.file.buffer : null,
  });
  res.json({ success: true, data: result });
});

const commitImport = wrap(async (req, res) => {
  const result = await memberImportService.commit(req.user.id, req.body);
  res.status(201).json({ success: true, data: result });
});

const resetPassword = wrap(async (req, res) => {
  const result = await adminService.resetMemberPassword(req.user.id, req.params.id);
  res.json({ success: true, data: result });
});

const renewMember = wrap(async (req, res) => {
  const result = await adminService.renewMember(
    req.user.id,
    req.params.id,
    req.body.months
  );
  res.json({ success: true, data: result });
});

const issueCertification = wrap(async (req, res) => {
  const certification = await certificationService.issue(
    req.user.id,
    req.params.id,
    req.body,
    req.file
  );
  res.status(201).json({ success: true, data: certification });
});

const createEvent = wrap(async (req, res) => {
  const event = await eventService.createEvent(req.user.id, req.body, req.file);
  res.status(201).json({ success: true, data: event });
});

const updateEvent = wrap(async (req, res) => {
  const event = await eventService.updateEvent(
    req.user.id,
    req.params.id,
    req.body,
    req.file
  );
  res.json({ success: true, data: event });
});

const deleteEvent = wrap(async (req, res) => {
  const result = await eventService.deleteEvent(req.user.id, req.params.id);
  res.json({ success: true, data: result });
});

const createNewsletter = wrap(async (req, res) => {
  const newsletter = await newsletterService.publish(req.user.id, req.body, req.file);
  res.status(201).json({ success: true, data: newsletter });
});

const createCvTemplate = wrap(async (req, res) => {
  const template = await adminService.createCvTemplate(req.user.id, req.body, req.file);
  res.status(201).json({ success: true, data: template });
});

const sendNotifications = wrap(async (req, res) => {
  const result = await adminService.sendNotifications(req.user.id, req.body);
  res.status(202).json({ success: true, data: result });
});

module.exports = {
  getStats,
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  listMembers,
  getMember,
  previewImport,
  commitImport,
  changeRole,
  changeStatus,
  resetPassword,
  renewMember,
  issueCertification,
  createEvent,
  updateEvent,
  deleteEvent,
  createNewsletter,
  createCvTemplate,
  sendNotifications,
};
