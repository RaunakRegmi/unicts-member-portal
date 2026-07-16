import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Badge, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get('/admin/stats')).data.data,
  });

  if (isLoading || !stats) return <Spinner />;

  const tiles = [
    ['Pending review', stats.pendingApplications, '/admin/applications?status=PENDING_APPROVAL'],
    ['Active members', stats.activeMembers, '/admin/members?status=ACTIVE'],
    ['Approved applications', stats.approvedApplications, '/admin/applications?status=APPROVED'],
    ['Upcoming events', stats.upcomingEvents, '/admin/events'],
  ];

  return (
    <div>
      <PageHeader title="Overview" subtitle="The society at a glance" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([label, value, to]) => (
          <Link key={label} to={to} className="card transition hover:shadow-md">
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            <div className="mt-1 text-sm text-slate-500">{label}</div>
          </Link>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">Latest applications</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-th">Applicant</th>
              <th className="table-th">Submitted</th>
              <th className="table-th">Status</th>
              <th className="table-th" />
            </tr>
          </thead>
          <tbody>
            {stats.recentApplications.map((app) => (
              <tr key={app.id} className="border-b border-slate-50">
                <td className="table-td">
                  <div className="font-medium">
                    {app.user.memberProfile
                      ? `${app.user.memberProfile.firstName || ''} ${app.user.memberProfile.lastName || ''}`
                      : '—'}
                  </div>
                  <div className="text-xs text-slate-400">{app.user.phoneNumber}</div>
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
    </div>
  );
}
