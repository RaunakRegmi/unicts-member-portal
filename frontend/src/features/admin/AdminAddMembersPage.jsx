import { useState } from 'react';
import { FileSpreadsheet, Plus, RotateCcw, Trash2, UserPlus, Wand2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Badge, ErrorText, PageHeader, SuccessText } from '../../components/ui';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';

const EMPTY_ROW = { name: '', email: '', phone: '', address: '' };

function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const pick = (set, n) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `${pick(letters, 6)}${Math.floor(100 + Math.random() * 900)}`;
}

function entryStatus(entry) {
  if (!entry.valid) return { label: `Invalid — ${entry.errors.join('; ')}`, tone: 'rose' };
  if (entry.duplicateInBatch) return { label: 'Duplicate row in this batch', tone: 'rose' };
  if (entry.existing) {
    return {
      label: `Already registered (matched by ${entry.existing.matchedBy}${
        entry.existing.name ? ` — ${entry.existing.name}` : ''
      })`,
      tone: 'amber',
    };
  }
  return { label: 'New', tone: 'emerald' };
}

const TONE_CLASSES = {
  rose: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-800',
  emerald: 'bg-emerald-50 text-emerald-700',
};

export default function AdminAddMembersPage() {
  const [stage, setStage] = useState('input'); // input → preview → done
  const [mode, setMode] = useState('manual'); // manual | excel
  const [rows, setRows] = useState([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const updateRow = (index, patch) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const runPreview = async () => {
    setError(null);
    setBusy(true);
    try {
      let response;
      if (mode === 'excel') {
        const form = new FormData();
        form.append('file', file);
        response = await api.post('/admin/members/import/preview', form);
      } else {
        const users = rows.filter((r) => r.name || r.email || r.phone);
        response = await api.post('/admin/members/import/preview', { users });
      }
      const data = response.data.data;
      setPreview(data);
      // Duplicates and invalid rows start UNselected — only clean new
      // entries are ticked by default.
      setSelected(
        new Set(
          data.entries
            .filter((e) => e.valid && !e.existing && !e.duplicateInBatch)
            .map((e) => e.index)
        )
      );
      setFilter('all');
      setStage('preview');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (index) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const commit = async () => {
    setError(null);
    setBusy(true);
    try {
      const users = preview.entries
        .filter((e) => selected.has(e.index))
        .map(({ name, email, phone, address }) => ({ name, email, phone, address }));
      const { data } = await api.post('/admin/members/import/commit', {
        users,
        defaultPassword,
      });
      setResults(data.data);
      setStage('done');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStage('input');
    setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setResults(null);
    setDefaultPassword('');
    setError(null);
  };

  const visibleEntries = preview
    ? preview.entries.filter((e) => {
        if (filter === 'new') return e.valid && !e.existing && !e.duplicateInBatch;
        if (filter === 'existing') return Boolean(e.existing);
        if (filter === 'invalid') return !e.valid || e.duplicateInBatch;
        return true;
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Add members"
        subtitle="Register people yourself — enter details manually or upload an Excel sheet. Each person receives their login credentials by SMS and/or email."
      />
      <ErrorText>{error}</ErrorText>

      {stage === 'input' && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setMode('manual')}
              className={`btn ${mode === 'manual' ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
            >
              <UserPlus className="h-4 w-4" /> Manual entry
            </button>
            <button
              onClick={() => setMode('excel')}
              className={`btn ${mode === 'excel' ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel upload
            </button>
          </div>

          {mode === 'manual' && (
            <div className="card">
              <p className="mb-4 text-sm text-slate-500">
                Name is required, plus at least an email or a phone number per person.
                Address is optional.
              </p>
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      className="input min-w-[160px] flex-1"
                      placeholder="Full name *"
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                    />
                    <input
                      className="input min-w-[180px] flex-1"
                      placeholder="Email"
                      value={row.email}
                      onChange={(e) => updateRow(index, { email: e.target.value })}
                    />
                    <input
                      className="input w-40"
                      placeholder="Phone"
                      value={row.phone}
                      onChange={(e) => updateRow(index, { phone: e.target.value })}
                    />
                    <input
                      className="input min-w-[160px] flex-1"
                      placeholder="Address (optional)"
                      value={row.address}
                      onChange={(e) => updateRow(index, { address: e.target.value })}
                    />
                    <button
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  className="btn-secondary"
                  onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])}
                >
                  <Plus className="h-4 w-4" /> Add row
                </button>
                <button
                  className="btn-primary"
                  disabled={busy || !rows.some((r) => r.name || r.email || r.phone)}
                  onClick={runPreview}
                >
                  {busy ? 'Checking…' : 'Check & preview'}
                </button>
              </div>
            </div>
          )}

          {mode === 'excel' && (
            <div className="card">
              <p className="mb-1 text-sm text-slate-500">
                Upload a .xlsx sheet with columns like{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  S.N | Name | Phone Number | Email | Address
                </code>
              </p>
              <p className="mb-4 text-xs text-slate-400">
                Header names are matched flexibly (e.g. “Mobile”, “Email Address” also
                work). Address may be left empty.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <FileUpload
                  label="Choose Excel sheet"
                  accept=".xlsx,.xls,.csv"
                  file={file}
                  onSelect={setFile}
                />
                <button
                  className="btn-primary"
                  disabled={busy || !file}
                  onClick={runPreview}
                >
                  {busy ? 'Parsing…' : 'Upload & preview'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {stage === 'preview' && preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {[
                ['all', `All (${preview.summary.total})`],
                ['new', `New (${preview.summary.new})`],
                ['existing', `Already registered (${preview.summary.alreadyRegistered})`],
                ['invalid', `Invalid (${preview.summary.invalid})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    filter === key
                      ? 'bg-brand-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Already-registered people are <b>unselected by default</b>. Selecting one
            never recreates their account or changes their password — it only re-sends
            them the login link.
          </p>

          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th w-10" />
                  <th className="table-th">Name</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Address</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => {
                  const status = entryStatus(entry);
                  const selectable = entry.valid && !entry.duplicateInBatch;
                  return (
                    <tr key={entry.index} className="border-b border-slate-50">
                      <td className="table-td">
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={selected.has(entry.index)}
                          onChange={() => toggle(entry.index)}
                        />
                      </td>
                      <td className="table-td font-medium">{entry.name || '—'}</td>
                      <td className="table-td">{entry.phone || '—'}</td>
                      <td className="table-td">{entry.email || '—'}</td>
                      <td className="table-td text-slate-500">{entry.address || '—'}</td>
                      <td className="table-td">
                        <span className={`badge ${TONE_CLASSES[status.tone]}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Field
                label="Default password for everyone in this batch"
                required
                hint="Sent with their credentials; they can change it via the reset link"
              >
                <div className="flex gap-2">
                  <input
                    className="input w-56"
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Min 8 chars, letter + number"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDefaultPassword(generatePassword())}
                  >
                    <Wand2 className="h-4 w-4" /> Generate
                  </button>
                </div>
              </Field>
              <button
                className="btn-primary"
                disabled={
                  busy ||
                  selected.size === 0 ||
                  defaultPassword.length < 8 ||
                  !/[a-zA-Z]/.test(defaultPassword) ||
                  !/\d/.test(defaultPassword)
                }
                onClick={commit}
              >
                {busy
                  ? 'Registering…'
                  : `Register ${selected.size} ${selected.size === 1 ? 'person' : 'people'} & send credentials`}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && results && (
        <div className="space-y-4">
          <SuccessText>
            Done — {results.summary.created} created,{' '}
            {results.summary.alreadyRegistered} already registered (re-sent login link),{' '}
            {results.summary.failed} failed.
          </SuccessText>

          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th">Name</th>
                  <th className="table-th">Contact</th>
                  <th className="table-th">Result</th>
                  <th className="table-th">Credentials sent via</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="table-td font-medium">{r.name}</td>
                    <td className="table-td text-slate-500">
                      {[r.phone, r.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="table-td">
                      {r.status === 'created' && <Badge status="APPROVED" />}
                      {r.status === 'already_registered_notified' && (
                        <span className="badge bg-amber-100 text-amber-800">
                          Already registered — link re-sent
                        </span>
                      )}
                      {(r.status === 'failed' || r.status === 'invalid') && (
                        <span className="badge bg-rose-100 text-rose-700">
                          Failed{r.error ? ` — ${r.error}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="table-td text-slate-500">
                      {(r.notified || [])
                        .map((n) => `${n.channel}${n.status === 'FAILED' ? ' (failed)' : ''}`)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-primary" onClick={reset}>
            <UserPlus className="h-4 w-4" /> Add more members
          </button>
        </div>
      )}
    </div>
  );
}
