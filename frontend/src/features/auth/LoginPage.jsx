import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import Field from '../../components/Field';
import { ErrorText } from '../../components/ui';

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your phone number or email'),
  password: z.string().min(1, 'Enter your password'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setError(null);
    try {
      const { data } = await api.post('/auth/login', values);
      useAuthStore.getState().setSession(data.data);
      const from = location.state && location.state.from;
      const fallback = data.data.user.role === 'MEMBER' ? '/dashboard' : '/admin';
      navigate(from || fallback, { replace: true });
    } catch (err) {
      const code =
        err.response && err.response.data && err.response.data.error
          ? err.response.data.error.code
          : null;
      if (code === 'VERIFICATION_REQUIRED' || code === 'EMAIL_VERIFICATION_REQUIRED') {
        const purpose =
          code === 'EMAIL_VERIFICATION_REQUIRED' ? 'EMAIL_VERIFICATION' : 'SIGNUP';
        sessionStorage.setItem('unicts_otp_identifier', values.identifier);
        sessionStorage.setItem('unicts_otp_purpose', purpose);
        navigate('/verify-otp', { state: { identifier: values.identifier, purpose } });
        return;
      }
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log in with your phone number (or email) and password.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <ErrorText>{error}</ErrorText>

          <Field
            label="Phone number or email"
            required
            error={errors.identifier && errors.identifier.message}
          >
            <input
              className="input"
              placeholder="98XXXXXXXX or you@example.com"
              {...register('identifier')}
            />
          </Field>

          <Field label="Password" required error={errors.password && errors.password.message}>
            <input className="input" type="password" {...register('password')} />
          </Field>

          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/forgot-password" className="font-semibold text-brand-700">
            Forgot password?
          </Link>
          <Link to="/apply" className="font-semibold text-brand-700">
            Apply for membership
          </Link>
        </div>
      </div>
    </div>
  );
}
