import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function NewsletterDetailPage() {
  const { id } = useParams();
  const { data: newsletter, isLoading } = useQuery({
    queryKey: ['newsletter', id],
    queryFn: async () => (await api.get(`/newsletters/${id}`)).data.data,
  });

  if (isLoading || !newsletter) return <Spinner />;

  return (
    <div>
      <Link to="/newsletters" className="text-sm font-semibold text-brand-700">
        ← All newsletters
      </Link>

      <article className="card mt-4">
        <h1 className="text-2xl font-bold text-slate-900">{newsletter.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          Published {formatDate(newsletter.publishedAt)}
        </p>
        <div className="prose mt-6 max-w-none whitespace-pre-line text-slate-700">
          {newsletter.content}
        </div>
        {newsletter.attachmentUrl && (
          <a
            href={newsletter.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mt-6"
          >
            Download attachment
          </a>
        )}
      </article>
    </div>
  );
}
