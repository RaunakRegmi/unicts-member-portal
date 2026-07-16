import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import { useApplication } from '../../../lib/hooks';
import { ErrorText, SuccessText, Badge } from '../../../components/ui';

export default function ReviewStep({ application, locked }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useApplication();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const completion = (data && data.completion) || { sections: [], percent: 0 };
  const payment = application.payment;
  const allDone = completion.percent === 100;

  const recordPayment = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post('/membership/application/payment');
      await queryClient.invalidateQueries({ queryKey: ['application'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post('/membership/application/submit');
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      navigate('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <ul className="mt-4 space-y-2">
          {completion.sections.map((section) => (
            <li
              key={section.key}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm"
            >
              <span className="font-medium text-slate-700">{section.label}</span>
              {section.complete ? (
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <Check className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="font-semibold text-amber-600">Incomplete</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Membership fee</h2>
            <p className="text-sm text-slate-500">
              Membership is currently free — NPR 0. Online payment gateways can be
              enabled later without changing your application.
            </p>
          </div>
          {payment ? (
            <Badge status={payment.status} />
          ) : (
            <button onClick={recordPayment} disabled={busy || locked} className="btn-secondary">
              Record payment (NPR 0)
            </button>
          )}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {locked && (
        <SuccessText>
          Your application has been submitted and is awaiting admin review.
        </SuccessText>
      )}

      {!locked && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {allDone
              ? 'Everything is complete — you can submit for review.'
              : 'Complete every section above before submitting.'}
          </p>
          <button onClick={submit} disabled={!allDone || busy} className="btn-primary">
            {busy ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      )}
    </div>
  );
}
