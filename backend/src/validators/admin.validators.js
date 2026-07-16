const { z } = require('zod');

// Multipart-friendly: event bodies may arrive as form-data strings
const eventFields = {
  title: z.string().trim().min(2, 'Enter a title').max(160),
  description: z.string().trim().min(1, 'Enter a description'),
  startDatetime: z.coerce.date(),
  endDatetime: z.coerce.date(),
  location: z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined)),
};

const createEventSchema = z
  .object(eventFields)
  .refine((d) => d.endDatetime > d.startDatetime, {
    message: 'End time must be after start time',
    path: ['endDatetime'],
  });

const updateEventSchema = z.object({
  title: eventFields.title.optional(),
  description: z.string().trim().min(1).optional(),
  startDatetime: z.coerce.date().optional(),
  endDatetime: z.coerce.date().optional(),
  location: eventFields.location,
});

const rejectApplicationSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required').max(1000),
});

const changeRoleSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN', 'SUPER_ADMIN']),
});

const changeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
});

const renewMemberSchema = z.object({
  months: z.coerce.number().int().min(1).max(60).default(12),
});

const sendNotificationSchema = z
  .object({
    audience: z.enum(['USER', 'ALL_ACTIVE_MEMBERS', 'PENDING_APPLICANTS']),
    userId: z.string().uuid().optional(),
    channel: z.enum(['SMS', 'EMAIL', 'IN_APP']),
    subject: z.string().trim().max(160).optional(),
    message: z.string().trim().min(1, 'Enter a message').max(2000),
  })
  .refine((d) => d.audience !== 'USER' || d.userId, {
    message: 'Pick the member to notify',
    path: ['userId'],
  });

const createCertificationSchema = z.object({
  title: z.string().trim().min(2).max(160),
  issuingBody: z.string().trim().min(2).max(160),
  issueDate: z.coerce.date(),
});

const createNewsletterSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(1),
});

const createCvTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  // Arrives as a JSON string from multipart forms
  templateSchema: z
    .union([z.record(z.any()), z.string().transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'templateSchema must be valid JSON' });
        return z.NEVER;
      }
    })])
    .optional(),
});

// Bulk member registration (manual rows or parsed Excel). Phone may arrive
// as a number when it came out of a spreadsheet cell.
const importUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([z.string().trim(), z.null()]).optional(),
  phone: z.union([z.string().trim(), z.number(), z.null()]).optional(),
  address: z.union([z.string().trim().max(300), z.null()]).optional(),
});

const commitImportSchema = z.object({
  users: z.array(importUserSchema).min(1).max(500),
  defaultPassword: z
    .string()
    .min(8, 'Default password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Default password must contain a letter')
    .regex(/\d/, 'Default password must contain a number'),
});

const listApplicationsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'])
    .optional(),
  category: z.enum(['GENERAL', 'INSTITUTIONAL']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const listMembersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['MEMBER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z
    .enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  rejectApplicationSchema,
  changeRoleSchema,
  changeStatusSchema,
  renewMemberSchema,
  sendNotificationSchema,
  createCertificationSchema,
  createNewsletterSchema,
  createCvTemplateSchema,
  commitImportSchema,
  listApplicationsQuerySchema,
  listMembersQuerySchema,
};
