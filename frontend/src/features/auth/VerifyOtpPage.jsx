import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useWizardStore } from '../../store/wizardStore';
import { ErrorText, SuccessText } from '../../components/ui';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const identifier =
    state.identifier || sessionStorage.getItem('unicts_otp_identifier') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(
    state.devOtp ? `Dev mode: your code is ${state.devOtp}` : null
  );
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  const pendingCategory = useWizardStore((s) => s.pendingCategory);
  const setPendingCategory = useWizardStore((s) => s.setPendingCategory);

  useEffect(() => {
    if (!identifier) navigate('/signup', { replace: true });
  }, [identifier, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', {
        identifier,
        code,
        purpose: 'SIGNUP',
      });
      useAuthStore.getState().setSession(data.data);
      sessionStorage.removeItem('unicts_otp_identifier');

      // If a category was picked on /apply before signup, open the
      // application now and drop straight into the wizard.
      if (pendingCategory) {
        try {
          await api.post('/membership/application', { category: pendingCategory });
        } catch {
          // Application may already exist — the wizard will pick it up
        }
        setPendingCategory(null);
        navigate('/membership/wizard/domain', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      const { data } = await api.post('/auth/resend-otp', {
        identifier,
        purpose: 'SIGNUP',
      });
      setCooldown(60);
      setInfo(
        data.data.devOtp
          ? `Dev mode: your code is ${data.data.devOtp}`
          : `A new code was sent by ${data.data.otpChannel}`
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-xl font-bold text-slate-900">Verify your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the 6-digit code sent to <b>{identifier}</b>
          {state.channel ? ` by ${state.channel}` : ''}.
        </p>

        <form onSubmit={verify} className="mt-6 space-y-4">
          <ErrorText>{error}</ErrorText>
          <SuccessText>{info}</SuccessText>

          <input
            className="input text-center text-2xl tracking-[0.5em]"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />

          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-500">
          Didn't get the code?{' '}
          <button
            onClick={resend}
            disabled={cooldown > 0}
            className="font-semibold text-brand-700 disabled:text-slate-400"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  );
}
