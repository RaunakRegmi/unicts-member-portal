const QRCode = require('qrcode');

async function qrDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
}

module.exports = { qrDataUrl };
