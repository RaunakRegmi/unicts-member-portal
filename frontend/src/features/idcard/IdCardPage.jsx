import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Badge, EmptyState, ErrorText, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function IdCardPage() {
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const { data: card, isLoading, error: loadError } = useQuery({
    queryKey: ['id-card'],
    queryFn: async () => (await api.get('/members/me/id-card')).data.data,
    retry: false,
  });

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      const { data } = await api.get('/members/me/id-card/download');
      window.open(data.data.url, '_blank');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <Spinner />;

  if (loadError) {
    return (
      <EmptyState
        title="No ID card yet"
        subtitle="Your digital ID card is issued automatically once your membership application is approved."
      />
    );
  }

  if (card && card.status === 'PENDING') {
    return (
      <EmptyState
        title="Your ID card is being generated"
        subtitle="This usually takes under a minute — check back shortly."
      />
    );
  }

  return (
    <div>
      <PageHeader title="My ID card" subtitle="Your official UNICTS digital identity" />
      <ErrorText>{error}</ErrorText>

      <div className="card max-w-xl">
        <div className="rounded-xl bg-gradient-to-br from-navy via-[#14417b] to-brand-800 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold tracking-wide">UNICTS</div>
            <Badge status={card.status} />
          </div>
          <div className="mt-6 text-2xl font-bold tracking-wider">{card.cardNumber}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <div>
              <div className="text-xs text-slate-400">Issued</div>
              {formatDate(card.issuedAt)}
            </div>
            <div>
              <div className="text-xs text-slate-400">Valid until</div>
              {formatDate(card.expiresAt)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={download} disabled={downloading} className="btn-primary">
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
          {card.qrCodeData && (
            <a
              href={card.qrCodeData}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Open verification page ↗
            </a>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Anyone can scan the QR code on your card to confirm your membership is valid —
          it opens the public verification page.
        </p>
      </div>
    </div>
  );
}
