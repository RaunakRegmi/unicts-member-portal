import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useWizardStore } from '../../store/wizardStore';
import { ErrorText } from '../../components/ui';

const CATEGORIES = [
  {
    key: 'GENERAL',
    title: 'General Membership',
    text: 'For individual ICT professionals, students, and enthusiasts. Complete your personal KYC, upload identity documents, and add a CV.',
    icon: User,
  },
  {
    key: 'INSTITUTIONAL',
    title: 'Institutional Membership',
    text: 'For companies and organizations. Everything in General, plus business verification: registration certificate and VAT/PAN documents.',
    icon: Building2,
  },
];

export default function ApplyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPendingCategory = useWizardStore((s) => s.setPendingCategory);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const choose = async (category) => {
    setError(null);
    if (!user) {
      // Remember the choice through signup; the application row is created
      // right after OTP verification succeeds.
      setPendingCategory(category);
      navigate('/signup');
      return;
    }
    setBusy(true);
    try {
      await api.post('/membership/application', { category });
      navigate('/membership/wizard/domain');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        navigate('/membership/wizard/domain');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-slate-900">
        Choose your membership category
      </h1>
      <p className="mt-2 text-center text-slate-500">
        You can switch categories any time before submitting your application.
      </p>
      <div className="mx-auto mt-4 max-w-lg">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            disabled={busy}
            onClick={() => choose(c.key)}
            className="card text-left transition hover:border-brand-500 hover:shadow-md disabled:opacity-60"
          >
            <c.icon className="h-10 w-10 text-brand-700" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">{c.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{c.text}</p>
            <span className="mt-4 inline-block font-semibold text-brand-700">
              Select →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
