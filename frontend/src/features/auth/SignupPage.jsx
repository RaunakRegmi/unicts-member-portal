import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, apiErrorMessage } from '../../lib/apiClient';
import Field from '../../components/Field';
import { ErrorText } from '../../components/ui';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email'),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?\d[\d\s-]{6,17}$/, 'Enter a valid phone number'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
    otpChannel: z.enum(['SMS', 'EMAIL']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function strength(password = '') {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = [
  'bg-rose-500',
  'bg-rose-400',
  'bg-amber-400',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-emerald-600',
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otpChannel: 'SMS' },
  });

  const password = watch('password') || '';
  const score = strength(password);

  const onSubmit = async (values) => {
    setError(null);
    try {
      const { data } = await api.post('/auth/signup', {
        name: values.name,
        email: values.email,
        phoneNumber: values.phoneNumber,
        password: values.password,
        otpChannel: values.otpChannel,
      });
      sessionStorage.setItem('unicts_otp_identifier', data.data.identifier);
      navigate('/verify-otp', {
        state: {
          identifier: data.data.identifier,
          channel: data.data.otpChannel,
          devOtp: data.data.devOtp,
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          One account for your application, ID card, and everything after.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <ErrorText>{error}</ErrorText>

          <Field label="Full name" required error={errors.name && errors.name.message}>
            <input className="input" placeholder="e.g. Sita Sharma" {...register('name')} />
          </Field>

          <Field label="Email" required error={errors.email && errors.email.message}>
            <input className="input" type="email" placeholder="you@example.com" {...register('email')} />
          </Field>

          <Field
            label="Phone number"
            required
            hint="You'll log in with this number"
            error={errors.phoneNumber && errors.phoneNumber.message}
          >
            <input className="input" placeholder="98XXXXXXXX" {...register('phoneNumber')} />
          </Field>

          <Field label="Password" required error={errors.password && errors.password.message}>
            <input className="input" type="password" {...register('password')} />
            {password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < score ? STRENGTH_COLORS[score] : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">{STRENGTH_LABELS[score]}</p>
              </div>
            )}
          </Field>

          <Field
            label="Confirm password"
            required
            error={errors.confirmPassword && errors.confirmPassword.message}
          >
            <input className="input" type="password" {...register('confirmPassword')} />
          </Field>

          <Field label="Send my verification code by" required>
            <div className="flex gap-6 py-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" value="SMS" {...register('otpChannel')} /> SMS
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="EMAIL" {...register('otpChannel')} /> Email
              </label>
            </div>
          </Field>

          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already a member?{' '}
          <Link to="/login" className="font-semibold text-brand-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
