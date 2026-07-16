import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { EmptyState, ErrorText, PageHeader, Spinner } from '../../components/ui';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';
import { formatDate } from '../../lib/format';

export default function AdminNewslettersPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: newsletters, isLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: async () => (await api.get('/newsletters')).data.data,
  });

  const publish = async () => {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('content', content);
      if (attachment) form.append('attachment', attachment);
      await api.post('/admin/newsletters', form);
      setTitle('');
      setContent('');
      setAttachment(null);
      await queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Newsletters" subtitle="Publish society news and announcements" />

      <div className="card">
        <h2 className="mb-3 font-semibold">Publish a newsletter</h2>
        <ErrorText>{error}</ErrorText>
        <div className="mt-2 space-y-3">
          <Field label="Title" required>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Content" required>
            <textarea
              className="input min-h-[140px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          <Field label="Attachment (optional)">
            <FileUpload file={attachment} onSelect={setAttachment} />
          </Field>
          <button
            className="btn-primary"
            disabled={busy || title.length < 2 || !content}
            onClick={publish}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <Spinner />}
        {!isLoading && (newsletters || []).length === 0 && (
          <EmptyState title="Nothing published yet" />
        )}
        <div className="space-y-3">
          {(newsletters || []).map((n) => (
            <div key={n.id} className="card">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{n.title}</h3>
                <span className="text-xs text-slate-400">{formatDate(n.publishedAt)}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-sm text-slate-500">{n.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
