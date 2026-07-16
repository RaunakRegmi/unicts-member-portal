// Magic-byte content sniffing — never trust the client's file extension.
function sniffMime(buffer) {
  if (!buffer || buffer.length < 5) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  // DOCX (and the rest of the OOXML family) is a ZIP container
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EXTENSION_CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.svg': 'image/svg+xml',
};

module.exports = { sniffMime, IMAGE_TYPES, DOCUMENT_TYPES, CV_TYPES, EXTENSION_CONTENT_TYPES };
