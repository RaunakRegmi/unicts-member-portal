const idcardService = require('../services/idcard.service');

async function getMine(req, res, next) {
  try {
    const card = await idcardService.getMyCard(req.user.id);
    res.status(200).json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const result = await idcardService.getDownloadUrl(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMine, download };
