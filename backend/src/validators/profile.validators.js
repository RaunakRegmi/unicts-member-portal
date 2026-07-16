const { z } = require('zod');

const MIN_AGE_YEARS = 16;
const minAgeCutoff = () =>
  new Date(Date.now() - MIN_AGE_YEARS * 365.25 * 24 * 3600 * 1000);

const phoneField = z
  .string()
  .trim()
  .regex(/^\+?\d[\d\s-]{6,17}$/, 'Enter a valid phone number');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  dob: z.coerce
    .date()
    .refine((d) => d <= minAgeCutoff(), `You must be at least ${MIN_AGE_YEARS} years old`)
    .optional(),
  gender: z.string().trim().min(1).max(40).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
  mobileNumber: phoneField.optional(),
  workplaceTelephone: z.string().trim().max(20).nullable().optional(),
  ictDomainId: z.string().uuid().nullable().optional(),
  socialProfileUrl: z.string().trim().url('Enter a valid URL').nullable().optional(),
  emergencyContactName: z.string().trim().max(120).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(20).nullable().optional(),
});

const addressFields = z.object({
  province: z.string().trim().min(1, 'Select a province'),
  district: z.string().trim().min(1, 'Select a district'),
  municipality: z.string().trim().min(1, 'Select a municipality'),
  wardNumber: z.string().trim().regex(/^\d{1,2}$/, 'Enter the ward number'),
  tole: z.string().trim().min(1, 'Enter the tole/street'),
});

const updateAddressSchema = z
  .object({
    permanent: addressFields,
    temporary: addressFields.optional(),
    sameAsPermanent: z.boolean().default(false),
  })
  .refine((data) => data.sameAsPermanent || data.temporary, {
    message: 'Provide a temporary address or tick "same as permanent"',
    path: ['temporary'],
  });

const updateEducationSchema = z.object({
  highestQualification: z.string().trim().min(1, 'Select your highest qualification'),
  institutionName: z.string().trim().max(160).nullable().optional(),
  fieldOfStudy: z.string().trim().max(120).nullable().optional(),
});

const NATURE_OF_JOB = [
  'permanent',
  'contract',
  'temporary',
  'self_employed',
  'student',
  'unemployed',
];

const updateEmploymentSchema = z.object({
  organizationName: z.string().trim().max(160).nullable().optional(),
  designation: z.string().trim().max(120).nullable().optional(),
  natureOfJob: z.enum(NATURE_OF_JOB),
  organizationSector: z.string().trim().min(1, 'Select a sector'),
});

const signatureSchema = z.object({
  dataUrl: z.string().startsWith('data:image/').optional(),
});

module.exports = {
  updateProfileSchema,
  updateAddressSchema,
  updateEducationSchema,
  updateEmploymentSchema,
  signatureSchema,
  BLOOD_GROUPS,
  NATURE_OF_JOB,
};
