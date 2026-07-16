const { z } = require('zod');

const parseCvSchema = z.object({
  cvId: z.string().uuid(),
});

const generateCvSchema = z.object({
  templateId: z.string().uuid().optional(),
  content: z
    .object({
      fullName: z.string().trim().max(120).optional(),
      headline: z.string().trim().max(160).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().max(20).optional(),
      summary: z.string().trim().max(2000).optional(),
      skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
      experience: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(120),
            organization: z.string().trim().max(160).optional(),
            period: z.string().trim().max(60).optional(),
            description: z.string().trim().max(1000).optional(),
          })
        )
        .max(15)
        .optional(),
      education: z
        .array(
          z.object({
            qualification: z.string().trim().min(1).max(120),
            institution: z.string().trim().max(160).optional(),
            fieldOfStudy: z.string().trim().max(120).optional(),
            period: z.string().trim().max(60).optional(),
          })
        )
        .max(10)
        .optional(),
    })
    .default({}),
});

module.exports = { parseCvSchema, generateCvSchema };
