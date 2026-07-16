const documentService = require('../services/document.service');

async function upload(req, res, next) {
  try {
    const result = await documentService.uploadIdentityDocument(
      req.user.id,
      req.body,
      req.files
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const documents = await documentService.listDocuments(req.user.id);
    res.status(200).json({ success: true, data: documents });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await documentService.deleteDocument(req.user.id, req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, list, remove };
