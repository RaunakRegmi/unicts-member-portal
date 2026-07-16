import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useMyDocuments, useProfile } from '../../lib/hooks';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';
import SignaturePad from '../../components/SignaturePad';
import { Badge, ErrorText } from '../../components/ui';

const DOC_TYPES = [
  { type: 'CITIZENSHIP', label: 'Citizenship', required: true, hasBack: true },
  { type: 'NATIONAL_ID', label: 'National ID (NID)', required: true, hasBack: true },
  { type: 'PASSPORT', label: 'Passport (optional)', hasBack: false },
  { type: 'PAN', label: 'PAN (optional)', hasBack: false },
];

function DocumentRow({ config, existing, locked, onChanged }) {
  const [number, setNumber] = useState('');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const upload = async () => {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('documentType', config.type);
      form.append('documentNumber', number);
      form.append('front', front);
      if (back) form.append('back', back);
      await api.post('/members/me/documents', form);
      setEditing(false);
      setNumber('');
      setFront(null);
      setBack(null);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await api.delete(`/members/me/documents/${existing.id}`);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-800">{config.label}</span>
          {config.required && <span className="text-rose-500"> *</span>}
          {existing && (
            <span className="ml-2 text-xs text-slate-400">No. {existing.documentNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {existing && <Badge status={existing.verificationStatus} />}
          {existing && !locked && (
            <>
              <button
                className="text-xs font-semibold text-brand-700"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? 'Cancel' : 'Replace'}
              </button>
              <button className="text-xs font-semibold text-rose-600" onClick={remove}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {existing && (
        <div className="mt-2 flex gap-3 text-xs">
          {existing.frontImageUrl && (
            <a href={existing.frontImageUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
              View front ↗
            </a>
          )}
          {existing.backImageUrl && (
            <a href={existing.backImageUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
              View back ↗
            </a>
          )}
        </div>
      )}

      {(!existing || editing) && !locked && (
        <div className="mt-4 space-y-3">
          <ErrorText>{error}</ErrorText>
          <Field label="Document number" required>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Front image / scan" required>
              <FileUpload file={front} onSelect={setFront} />
            </Field>
            {config.hasBack && (
              <Field label="Back image / scan">
                <FileUpload file={back} onSelect={setBack} />
              </Field>
            )}
          </div>
          <button
            className="btn-primary"
            disabled={busy || !number || !front}
            onClick={upload}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DocumentsManager({ locked }) {
  const queryClient = useQueryClient();
  const { data: documents } = useMyDocuments();
  const { data: profile } = useProfile();

  const [photo, setPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: ['application'] }),
      queryClient.invalidateQueries({ queryKey: ['completion'] }),
    ]);
  };

  const uploadPhoto = async () => {
    setError(null);
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append('file', photo);
      await api.post('/members/me/profile-picture', form);
      setPhoto(null);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveSignature = async () => {
    setError(null);
    setSignatureBusy(true);
    try {
      await api.post('/members/me/signature', { dataUrl: signatureData });
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSignatureBusy(false);
    }
  };

  const byType = Object.fromEntries((documents || []).map((d) => [d.documentType, d]));

  return (
    <div className="space-y-6">
      <ErrorText>{error}</ErrorText>

      <div className="card">
        <h2 className="text-lg font-semibold">Profile photo</h2>
        <p className="text-sm text-slate-500">
          A clear, front-facing photo — it appears on your ID card.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <FileUpload
            label="Choose photo"
            accept="image/jpeg,image/png"
            file={photo}
            onSelect={setPhoto}
            previewUrl={profile && profile.profilePictureUrl}
          />
          {photo && !locked && (
            <button className="btn-primary" onClick={uploadPhoto} disabled={photoBusy}>
              {photoBusy ? 'Uploading…' : 'Save photo'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Signature</h2>
        <p className="text-sm text-slate-500">
          Draw your signature — it is printed on your ID card.
        </p>
        {profile && profile.signatureUrl && (
          <img
            src={profile.signatureUrl}
            alt="Current signature"
            className="mt-3 h-14 rounded border border-slate-200 bg-white object-contain px-2"
          />
        )}
        {!locked && (
          <div className="mt-4">
            <SignaturePad onChange={setSignatureData} />
            <button
              className="btn-primary mt-2"
              disabled={!signatureData || signatureBusy}
              onClick={saveSignature}
            >
              {signatureBusy ? 'Saving…' : 'Save signature'}
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Identity documents</h2>
          <p className="text-sm text-slate-500">
            Citizenship and National ID are required. Adding a Passport or PAN makes
            your profile stronger. JPG, PNG, or PDF up to 5MB.
          </p>
        </div>
        {DOC_TYPES.map((config) => (
          <DocumentRow
            key={config.type}
            config={config}
            existing={byType[config.type]}
            locked={locked}
            onChanged={refresh}
          />
        ))}
      </div>
    </div>
  );
}
