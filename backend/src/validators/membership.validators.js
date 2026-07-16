const { z } = require('zod');

const startApplicationSchema = z.object({
  category: z.enum(['GENERAL', 'INSTITUTIONAL']),
  membershipGroupId: z.string().uuid().optional(),
});

// Files (businessRegistrationDoc, vatOrPanDoc) arrive via multipart and are
// validated by content sniffing in the document service.
const institutionalDetailSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name'),
  businessRegistrationNumber: z.string().trim().min(1, 'Enter the registration number'),
  vatOrPanNumber: z.string().trim().min(1, 'Enter the VAT or PAN number'),
});

module.exports = { startApplicationSchema, institutionalDetailSchema };
