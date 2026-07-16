const { z } = require('zod');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d[\d\s-]{6,17}$/, 'Enter a valid phone number');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const identifierSchema = z.string().trim().min(3, 'Enter your phone number or email');

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phoneNumber: phoneSchema,
  password: passwordSchema,
  otpChannel: z.enum(['SMS', 'EMAIL']).default('SMS'),
});

const otpPurposes = ['SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'];

const verifyOtpSchema = z.object({
  identifier: identifierSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits'),
  purpose: z.enum(otpPurposes).default('SIGNUP'),
});

const resendOtpSchema = z.object({
  identifier: identifierSchema,
  purpose: z.enum(otpPurposes).default('SIGNUP'),
  channel: z.enum(['SMS', 'EMAIL']).optional(),
});

// Members normally log in with their phone number, but admin-imported
// accounts may only have an email — so the identifier accepts either.
const loginSchema = z
  .object({
    identifier: identifierSchema.optional(),
    phoneNumber: phoneSchema.optional(),
    password: z.string().min(1, 'Enter your password'),
  })
  .refine((d) => d.identifier || d.phoneNumber, {
    message: 'Enter your phone number or email',
    path: ['identifier'],
  });

const forgotPasswordSchema = z.object({
  identifier: identifierSchema,
});

const resetPasswordSchema = z.object({
  identifier: identifierSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits'),
  newPassword: passwordSchema,
});

module.exports = {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
