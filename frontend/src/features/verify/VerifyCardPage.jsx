import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { formatDate, statusLabel } from '../../lib/format';
import { FullPageSpinner } from '../../components/ui';

// Public page behind the QR code on every UNICTS ID card.
export default function VerifyCardPage() {
  const { cardNumber } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-card', cardNumber],
    queryFn: async () => (await api.get(`/verify/${cardNumber}`)).data.data,
    retry: false,
  });

  if (isLoading) return <FullPageSpinner />;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card">
          <CircleX className="mx-auto h-14 w-14 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Card not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            No UNICTS ID card matches <b>{cardNumber}</b>. The card may be invalid or
            revoked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card text-center">
        {data.valid ? (
          <CircleCheck className="mx-auto h-14 w-14 text-emerald-500" />
        ) : (
          <TriangleAlert className="mx-auto h-14 w-14 text-amber-500" />
        )}
        <h1 className="mt-3 text-xl font-bold">
          {data.valid ? 'Valid UNICTS Membership' : `Card ${statusLabel(data.status)}`}
        </h1>

        {data.photoUrl && (
          <img
            src={data.photoUrl}
            alt={data.memberName}
            className="mx-auto mt-5 h-28 w-28 rounded-full border-4 border-brand-100 object-cover"
          />
        )}

        <div className="mt-4 text-lg font-semibold text-slate-900">{data.memberName}</div>
        <div className="text-sm text-slate-500">
          {data.category === 'INSTITUTIONAL' ? 'Institutional Member' : 'General Member'} ·{' '}
          {data.group} Group
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Card number</dt>
            <dd className="font-semibold">{data.cardNumber}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Status</dt>
            <dd className="font-semibold">{statusLabel(data.status)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Issued</dt>
            <dd className="font-semibold">{formatDate(data.issuedAt)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-400">Valid until</dt>
            <dd className="font-semibold">{formatDate(data.expiresAt)}</dd>
          </div>
        </dl>

        {data.socialProfileUrl && (
          <a
            href={data.socialProfileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mt-6 w-full"
          >
            View member's professional profile ↗
          </a>
        )}
      </div>
    </div>
  );
}
