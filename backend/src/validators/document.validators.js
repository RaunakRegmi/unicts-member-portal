const { z } = require('zod');

const uploadDocumentSchema = z.object({
  documentType: z.enum(['CITIZENSHIP', 'NATIONAL_ID', 'PASSPORT', 'PAN']),
  documentNumber: z.string().trim().min(1, 'Enter the document number').max(60),
});

module.exports = { uploadDocumentSchema };
