import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useApplication } from '../../lib/hooks';
import { Badge, EmptyState, ErrorText, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function PaymentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApplication();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Spinner />;

  const application = data && data.application;
  if (!application) {
    return (
      <EmptyState
        title="No application yet"
        subtitle="Start a membership application before recording payment."
      />
    );
  }

  const payment = application.payment;

  const record = async () => {
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

  return (
    <div>
      <PageHeader title="Payment" subtitle="Membership fee for your application" />
      <ErrorText>{error}</ErrorText>

      <div className="card max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-slate-900">NPR 0</div>
            <p className="mt-1 text-sm text-slate-500">
              UNICTS membership is currently free. Online payment (eSewa, Khalti,
              ConnectIPS) can be switched on later without affecting your membership.
            </p>
          </div>
          {payment && <Badge status={payment.status} />}
        </div>

        {payment ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Payment recorded {formatDateTime(payment.paidAt)} — you're all set.
          </p>
        ) : (
          <button onClick={record} disabled={busy} className="btn-primary mt-4">
            {busy ? 'Recording…' : 'Record payment (NPR 0)'}
          </button>
        )}
      </div>
    </div>
  );
}
