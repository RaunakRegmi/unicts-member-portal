import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import { useIctDomains, useProfile } from '../../../lib/hooks';
import { ErrorText, Spinner } from '../../../components/ui';

export default function DomainStep({ onNext, locked }) {
  const queryClient = useQueryClient();
  const { data: domains, isLoading } = useIctDomains();
  const { data: profile } = useProfile();
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile && profile.ictDomainId) setSelected(profile.ictDomainId);
  }, [profile]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.patch('/members/me/profile', { ictDomainId: selected });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      onNext();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Which ICT domain do you work in?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Pick the area closest to your work or interest — you can change it later.
      </p>

      <div className="mt-5">
        <ErrorText>{error}</ErrorText>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(domains || []).map((domain) => (
          <button
            key={domain.id}
            type="button"
            disabled={locked}
            onClick={() => setSelected(domain.id)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              selected === domain.id
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {domain.name}
          </button>
        ))}
      </div>

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onNext} className="btn-secondary">
          Skip for now
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!selected || busy || locked}
          className="btn-primary"
        >
          {busy ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  );
}
