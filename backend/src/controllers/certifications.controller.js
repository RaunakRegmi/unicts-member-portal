const certificationService = require('../services/certification.service');

async function listMine(req, res, next) {
  try {
    const certifications = await certificationService.listForUser(req.user.id);
    res.status(200).json({ success: true, data: certifications });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMine };
