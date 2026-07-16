const idcardService = require('../services/idcard.service');

// Public: backs the QR code on every ID card (see §9.8 of the spec).
async function verifyCard(req, res, next) {
  try {
    const result = await idcardService.verifyCard(req.params.cardNumber);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyCard };
