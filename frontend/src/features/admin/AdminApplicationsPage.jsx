import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui';
import ProgressBar from '../../components/ProgressBar';
import { formatDateTime } from '../../lib/format';

const STATUSES = ['', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DRAFT'];

export default function AdminApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'applications', { status, search, page }],
    queryFn: async () =>
      (
        await api.get('/admin/applications', {
          params: { status: status || undefined, search: search || undefined, page },
        })
      ).data.data,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Applications" subtitle="Review membership applications" />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="input max-w-[220px]"
          value={status}
          onChange={(e) => {
            setPage(1);
            setParams(e.target.value ? { status: e.target.value } : {});
          }}
        >
          <option value="">All (non-draft)</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <input
          className="input max-w-xs"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {isLoading && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No applications found" />}

      {data && data.items.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">Applicant</th>
                <th className="table-th">Category</th>
                <th className="table-th">Completion</th>
                <th className="table-th">Submitted</th>
                <th className="table-th">Status</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((app) => (
                <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="table-td">
                    <div className="font-medium">
                      {app.user.memberProfile
                        ? `${app.user.memberProfile.firstName || ''} ${app.user.memberProfile.lastName || ''}`
                        : '—'}
                    </div>
                    <div className="text-xs text-slate-400">{app.user.phoneNumber}</div>
                  </td>
                  <td className="table-td capitalize">{app.category.toLowerCase()}</td>
                  <td className="table-td w-40">
                    <ProgressBar percent={app.completionPercent} />
                  </td>
                  <td className="table-td text-slate-500">{formatDateTime(app.submittedAt)}</td>
                  <td className="table-td">
                    <Badge status={app.status} />
                  </td>
                  <td className="table-td text-right">
                    <Link
                      to={`/admin/applications/${app.id}`}
                      className="font-semibold text-brand-700"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
