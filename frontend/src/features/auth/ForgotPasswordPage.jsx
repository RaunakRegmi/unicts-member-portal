import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/apiClient';
import Field from '../../components/Field';
import { ErrorText, SuccessText } from '../../components/ui';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request'); // request → reset → done
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const request = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier });
      setInfo(
        data.data.devOtp
          ? `Dev mode: your code is ${data.data.devOtp}`
          : 'If that account exists, a reset code has been sent.'
      );
      setStep('reset');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { identifier, code, newPassword });
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>

        {step === 'request' && (
          <form onSubmit={request} className="mt-6 space-y-4">
            <ErrorText>{error}</ErrorText>
            <Field
              label="Phone number or email"
              required
              hint="We'll send a 6-digit reset code"
            >
              <input
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </Field>
            <button className="btn-primary w-full" disabled={busy || !identifier}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={reset} className="mt-6 space-y-4">
            <ErrorText>{error}</ErrorText>
            <SuccessText>{info}</SuccessText>
            <Field label="6-digit code" required>
              <input
                className="input text-center tracking-[0.4em]"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="New password" required hint="Min 8 characters, with a letter and a number">
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <button
              className="btn-primary w-full"
              disabled={busy || code.length !== 6 || newPassword.length < 8}
            >
              {busy ? 'Resetting…' : 'Set new password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6 space-y-4">
            <SuccessText>Your password has been reset.</SuccessText>
            <Link to="/login" className="btn-primary w-full">
              Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
