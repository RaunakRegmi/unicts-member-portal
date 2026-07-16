import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import { useProfile } from '../../../lib/hooks';
import AddressCascadeSelect from '../../../components/AddressCascadeSelect';
import { ErrorText } from '../../../components/ui';

const EMPTY = { province: '', district: '', municipality: '', wardNumber: '', tole: '' };

const isComplete = (a) =>
  a.province && a.district && a.municipality && a.wardNumber && a.tole;

export default function AddressStep({ onNext, locked }) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [permanent, setPermanent] = useState(EMPTY);
  const [temporary, setTemporary] = useState(EMPTY);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile || !profile.addresses) return;
    const perm = profile.addresses.find((a) => a.type === 'PERMANENT');
    const temp = profile.addresses.find((a) => a.type === 'TEMPORARY');
    if (perm) setPermanent({ ...EMPTY, ...pick(perm) });
    if (temp) {
      setTemporary({ ...EMPTY, ...pick(temp) });
      setSameAsPermanent(Boolean(temp.sameAsPermanent));
    }
  }, [profile]);

  const save = async () => {
    setError(null);
    if (!isComplete(permanent)) {
      setError('Complete every field of your permanent address');
      return;
    }
    if (!sameAsPermanent && !isComplete(temporary)) {
      setError('Complete the temporary address, or tick "same as permanent"');
      return;
    }
    setBusy(true);
    try {
      await api.patch('/members/me/address', {
        permanent,
        temporary: sameAsPermanent ? undefined : temporary,
        sameAsPermanent,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      onNext();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold">Permanent address</h2>
        <div className="mt-4">
          <AddressCascadeSelect value={permanent} onChange={setPermanent} />
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Temporary address</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={sameAsPermanent}
              disabled={locked}
              onChange={(e) => setSameAsPermanent(e.target.checked)}
            />
            Same as permanent
          </label>
        </div>
        {!sameAsPermanent && (
          <div className="mt-4">
            <AddressCascadeSelect value={temporary} onChange={setTemporary} />
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex justify-end">
        <button onClick={save} disabled={busy || locked} className="btn-primary">
          {busy ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  );
}

function pick(address) {
  return {
    province: address.province,
    district: address.district,
    municipality: address.municipality,
    wardNumber: address.wardNumber,
    tole: address.tole,
  };
}
