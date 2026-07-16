import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useCvTemplates } from '../../lib/hooks';
import { EmptyState, ErrorText, PageHeader, Spinner } from '../../components/ui';
import Field from '../../components/Field';

export default function AdminCvTemplatesPage() {
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useCvTemplates();
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState('#0e7490');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post('/admin/cv-templates', {
        name,
        templateSchema: { accentColor, layout: 'classic' },
      });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['cv-templates'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="CV templates"
        subtitle="Designs members can pick in the CV builder"
      />

      <div className="card max-w-xl">
        <h2 className="mb-3 font-semibold">Add a template</h2>
        <ErrorText>{error}</ErrorText>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <Field label="Name" required>
            <input className="input w-56" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Accent color">
            <input
              className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </Field>
          <button className="btn-primary" disabled={busy || name.length < 2} onClick={create}>
            {busy ? 'Adding…' : 'Add template'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <Spinner />}
        {!isLoading && (templates || []).length === 0 && <EmptyState title="No templates yet" />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates || []).map((t) => (
            <div key={t.id} className="card">
              <div
                className="h-2 w-full rounded-full"
                style={{ background: (t.templateSchema && t.templateSchema.accentColor) || '#0e7490' }}
              />
              <div className="mt-3 font-semibold text-slate-800">{t.name}</div>
              <div className="text-xs text-slate-400">
                Accent {(t.templateSchema && t.templateSchema.accentColor) || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
