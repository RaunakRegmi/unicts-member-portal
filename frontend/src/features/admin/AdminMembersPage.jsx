import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function AdminMembersPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'members', { search, role, status, page }],
    queryFn: async () =>
      (
        await api.get('/admin/members', {
          params: {
            search: search || undefined,
            role: role || undefined,
            status: status || undefined,
            page,
          },
        })
      ).data.data,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Members" subtitle="Search, manage roles, and member lifecycle" />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select className="input max-w-[160px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <select
          className="input max-w-[190px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_VERIFICATION">Pending verification</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      {isLoading && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No members found" />}

      {data && data.items.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">Member</th>
                <th className="table-th">Role</th>
                <th className="table-th">Status</th>
                <th className="table-th">Membership</th>
                <th className="table-th">Joined</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => {
                const latestApp = user.membershipApplications[0];
                return (
                  <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="table-td">
                      <div className="font-medium">
                        {user.memberProfile
                          ? `${user.memberProfile.firstName || ''} ${user.memberProfile.lastName || ''}`
                          : '—'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {user.phoneNumber} · {user.email}
                      </div>
                    </td>
                    <td className="table-td">{user.role}</td>
                    <td className="table-td">
                      <Badge status={user.status} />
                    </td>
                    <td className="table-td">
                      {latestApp ? (
                        <>
                          <Badge status={latestApp.status} />
                          {latestApp.expiresAt && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              until {formatDate(latestApp.expiresAt)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No application</span>
                      )}
                    </td>
                    <td className="table-td text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="table-td text-right">
                      <Link
                        to={`/admin/members/${user.id}`}
                        className="font-semibold text-brand-700"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
