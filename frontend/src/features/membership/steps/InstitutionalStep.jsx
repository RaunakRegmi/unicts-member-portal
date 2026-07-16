import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import Field from '../../../components/Field';
import FileUpload from '../../../components/FileUpload';
import { ErrorText } from '../../../components/ui';

export default function InstitutionalStep({ onNext, application, locked }) {
  const queryClient = useQueryClient();
  const detail = application.institutionalDetail;

  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vatOrPanNumber, setVatOrPanNumber] = useState('');
  const [regDoc, setRegDoc] = useState(null);
  const [vatDoc, setVatDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setBusinessName(detail.businessName || '');
    setRegistrationNumber(detail.businessRegistrationNumber || '');
    setVatOrPanNumber(detail.vatOrPanNumber || '');
  }, [detail]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('businessName', businessName);
      form.append('businessRegistrationNumber', registrationNumber);
      form.append('vatOrPanNumber', vatOrPanNumber);
      if (regDoc) form.append('businessRegistrationDoc', regDoc);
      if (vatDoc) form.append('vatOrPanDoc', vatDoc);
      await api.patch('/membership/application/institutional-detail', form);
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      onNext();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold">Business verification</h2>
      <p className="text-sm text-slate-500">
        Institutional membership needs your organization's registration and VAT/PAN
        documents on top of the personal KYC.
      </p>
      <ErrorText>{error}</ErrorText>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required>
          <input
            className="input"
            disabled={locked}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </Field>
        <Field label="Business registration number" required>
          <input
            className="input"
            disabled={locked}
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
          />
        </Field>
        <Field
          label="Business registration document"
          required
          hint={detail && detail.businessRegistrationDocUrl ? 'Already uploaded — choose a file to replace' : 'JPG, PNG, or PDF'}
        >
          <FileUpload file={regDoc} onSelect={setRegDoc} />
        </Field>
        <Field label="VAT / PAN number" required>
          <input
            className="input"
            disabled={locked}
            value={vatOrPanNumber}
            onChange={(e) => setVatOrPanNumber(e.target.value)}
          />
        </Field>
        <Field
          label="VAT / PAN document"
          required
          hint={detail && detail.vatOrPanDocUrl ? 'Already uploaded — choose a file to replace' : 'JPG, PNG, or PDF'}
        >
          <FileUpload file={vatDoc} onSelect={setVatDoc} />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy || locked || !businessName || !registrationNumber || !vatOrPanNumber}
          className="btn-primary"
        >
          {busy ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </div>
  );
}
