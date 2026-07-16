const cvService = require('../services/cv.service');
const { ApiError } = require('../utils/errors');

async function upload(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Attach your CV file', 'MISSING_FILE');
    const result = await cvService.uploadCv(req.user.id, req.file);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function parse(req, res, next) {
  try {
    const result = await cvService.reparseCv(req.user.id, req.body.cvId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const cvs = await cvService.listMyCvs(req.user.id);
    res.status(200).json({ success: true, data: cvs });
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  try {
    const result = await cvService.generateCv(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listTemplates(req, res, next) {
  try {
    const templates = await cvService.listTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, parse, listMine, generate, listTemplates };
