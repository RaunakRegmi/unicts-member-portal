import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useMyCvs, useCvTemplates } from '../../lib/hooks';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';
import { ErrorText, SuccessText } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

function ParsedPreview({ parsed }) {
  if (!parsed) return null;
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="font-semibold text-emerald-800">
        Extracted from your CV — review before relying on it:
      </p>
      <ul className="mt-2 space-y-1 text-emerald-900">
        {parsed.email && <li>Email: {parsed.email}</li>}
        {parsed.phone && <li>Phone: {parsed.phone}</li>}
        {parsed.skills && parsed.skills.length > 0 && (
          <li className="flex flex-wrap gap-1">
            Skills:{' '}
            {parsed.skills.slice(0, 12).map((s) => (
              <span key={s} className="badge bg-white text-emerald-800">
                {s}
              </span>
            ))}
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-emerald-700">
        Parsing is automated and can misread fields — you always have the final say.
        Update your KYC form if anything is off.
      </p>
    </div>
  );
}

export default function CvManager({ locked }) {
  const queryClient = useQueryClient();
  const { data: cvs } = useMyCvs();
  const { data: templates } = useCvTemplates();

  const [file, setFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [lastParsed, setLastParsed] = useState(null);
  const [error, setError] = useState(null);

  const [templateId, setTemplateId] = useState(null);
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState([]);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cvs'] }),
      queryClient.invalidateQueries({ queryKey: ['application'] }),
      queryClient.invalidateQueries({ queryKey: ['completion'] }),
    ]);
  };

  const upload = async () => {
    setError(null);
    setUploadBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/members/me/cv/upload', form);
      setLastParsed(data.data.cv.parsedData);
      setFile(null);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploadBusy(false);
    }
  };

  const generate = async () => {
    setError(null);
    setGenerateBusy(true);
    setGeneratedUrl(null);
    try {
      const { data } = await api.post('/members/me/cv/generate', {
        templateId: templateId || undefined,
        content: {
          summary: summary || undefined,
          skills: skills
            ? skills.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          experience: experience.filter((e) => e.title),
        },
      });
      setGeneratedUrl(data.data.cv.fileUrl);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerateBusy(false);
    }
  };

  const updateExperience = (index, patch) => {
    setExperience((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-6">
      <ErrorText>{error}</ErrorText>

      {(cvs || []).length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold">Your CVs</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {cvs.map((cv) => (
              <li key={cv.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium">
                    {cv.sourceType === 'GENERATED'
                      ? `Generated${cv.template ? ` · ${cv.template.name}` : ''}`
                      : 'Uploaded'}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {formatDateTime(cv.createdAt)}
                  </span>
                </div>
                {cv.fileUrl && (
                  <a
                    href={cv.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-700"
                  >
                    Open ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!locked && (
        <div className="card">
          <h2 className="text-lg font-semibold">Upload an existing CV</h2>
          <p className="text-sm text-slate-500">
            PDF or DOCX — we'll extract what we can to speed up your application.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <FileUpload
              label="Choose CV"
              accept="application/pdf,.docx"
              file={file}
              onSelect={setFile}
            />
            {file && (
              <button className="btn-primary" onClick={upload} disabled={uploadBusy}>
                {uploadBusy ? 'Uploading…' : 'Upload & parse'}
              </button>
            )}
          </div>
          <ParsedPreview parsed={lastParsed} />
        </div>
      )}

      {!locked && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">No CV? Build one</h2>
            <p className="text-sm text-slate-500">
              We reuse your KYC details (name, contact, education, employment) and add
              the extras below.
            </p>
          </div>

          <Field label="Template">
            <div className="flex flex-wrap gap-3">
              {(templates || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    templateId === t.id
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Professional summary">
            <textarea
              className="input min-h-[90px]"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A short paragraph about you…"
            />
          </Field>

          <Field label="Skills" hint="Comma-separated, e.g. React, Node.js, PostgreSQL">
            <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </Field>

          <Field label="Experience">
            <div className="space-y-3">
              {experience.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  <input
                    className="input"
                    placeholder="Role / title"
                    value={row.title || ''}
                    onChange={(e) => updateExperience(index, { title: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Organization"
                    value={row.organization || ''}
                    onChange={(e) => updateExperience(index, { organization: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Period (e.g. 2022 – present)"
                    value={row.period || ''}
                    onChange={(e) => updateExperience(index, { period: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="Short description"
                      value={row.description || ''}
                      onChange={(e) => updateExperience(index, { description: e.target.value })}
                    />
                    <button
                      type="button"
                      className="text-rose-600"
                      onClick={() => setExperience((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setExperience((rows) => [...rows, {}])}
              >
                + Add experience
              </button>
            </div>
          </Field>

          {generatedUrl && (
            <SuccessText>
              CV generated —{' '}
              <a href={generatedUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                open the PDF ↗
              </a>
            </SuccessText>
          )}

          <button className="btn-primary" onClick={generate} disabled={generateBusy}>
            {generateBusy ? 'Generating…' : 'Generate CV PDF'}
          </button>
        </div>
      )}
    </div>
  );
}
