import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function NewslettersPage() {
  const { data: newsletters, isLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: async () => (await api.get('/newsletters')).data.data,
  });

  return (
    <div>
      <PageHeader title="Newsletters" subtitle="News and announcements from UNICTS" />

      {isLoading && <Spinner />}
      {!isLoading && (newsletters || []).length === 0 && (
        <EmptyState title="No newsletters yet" />
      )}

      <div className="space-y-3">
        {(newsletters || []).map((n) => (
          <Link
            key={n.id}
            to={`/newsletters/${n.id}`}
            className="card block transition hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{n.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{n.content}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {formatDate(n.publishedAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
