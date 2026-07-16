import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Files, FileText, IdCard, CalendarDays, Hand, MailWarning } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useApplication } from '../../lib/hooks';
import { useAuthStore } from '../../store/authStore';
import { Badge, ErrorText, PageHeader, Spinner } from '../../components/ui';
import ProgressBar from '../../components/ProgressBar';
import { formatDate, formatDateTime } from '../../lib/format';

const QUICK_LINKS = [
  ['/documents', Files, 'Documents'],
  ['/cv', FileText, 'CV'],
  ['/id-card', IdCard, 'ID Card'],
  ['/events', CalendarDays, 'Events'],
];

const RENEWAL_WINDOW_DAYS = 60;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useApplication();
  const [error, setError] = useState(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const startEmailVerification = async () => {
    setError(null);
    setVerifyBusy(true);
    try {
      const { data: res } = await api.post('/auth/resend-otp', {
        identifier: user.email,
        purpose: 'EMAIL_VERIFICATION',
        channel: 'EMAIL',
      });
      sessionStorage.setItem('unicts_otp_identifier', user.email);
      sessionStorage.setItem('unicts_otp_purpose', 'EMAIL_VERIFICATION');
      navigate('/verify-otp', {
        state: {
          identifier: user.email,
          purpose: 'EMAIL_VERIFICATION',
          channel: 'EMAIL',
          devOtp: res.data.devOtp,
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err));
      setVerifyBusy(false);
    }
  };

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/members/me/notifications')).data.data,
  });

  if (isLoading) return <Spinner />;

  const application = data && data.application;
  const completion = data && data.completion;

  const daysLeft =
    application && application.expiresAt
      ? Math.ceil((new Date(application.expiresAt) - new Date()) / 86400000)
      : null;
  const canRenew =
    application &&
    application.status === 'APPROVED' &&
    daysLeft !== null &&
    daysLeft <= RENEWAL_WINDOW_DAYS;

  const renew = async () => {
    setError(null);
    setRenewBusy(true);
    try {
      await api.post('/membership/application/renew');
      await queryClient.invalidateQueries({ queryKey: ['application'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRenewBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Namaste{user && user.email ? `, ${user.email.split('@')[0]}` : ''}
            <Hand className="h-6 w-6 text-amber-500" />
          </span>
        }
        subtitle="Your UNICTS membership at a glance"
      />
      <ErrorText>{error}</ErrorText>

      {user && user.email && user.emailVerifiedAt === null && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <MailWarning className="h-5 w-5 shrink-0" />
            <span>
              <b>{user.email}</b> isn't verified yet — verify it once to log in with
              your email and keep receiving notices there.
            </span>
          </div>
          <button
            onClick={startEmailVerification}
            disabled={verifyBusy}
            className="btn-secondary"
          >
            {verifyBusy ? 'Sending code…' : 'Verify email'}
          </button>
        </div>
      )}

      <div className="card">
        {!application && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Start your membership application</h2>
              <p className="text-sm text-slate-500">
                Choose a category and complete your KYC to become a member.
              </p>
            </div>
            <Link to="/apply" className="btn-primary">
              Apply now
            </Link>
          </div>
        )}

        {application && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {application.category === 'INSTITUTIONAL' ? 'Institutional' : 'General'}{' '}
                  membership
                </h2>
                <p className="text-sm text-slate-500">
                  {application.membershipGroup && application.membershipGroup.name} group
                  {application.expiresAt && application.status === 'APPROVED' && (
                    <> · valid until {formatDate(application.expiresAt)}</>
                  )}
                </p>
              </div>
              <Badge status={application.status} />
            </div>

            {['DRAFT', 'REJECTED'].includes(application.status) && (
              <div className="mt-4">
                <ProgressBar percent={completion ? completion.percent : 0} />
                {application.status === 'REJECTED' && application.rejectionReason && (
                  <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                    Rejected: {application.rejectionReason}
                  </p>
                )}
                <Link to="/membership/wizard/domain" className="btn-primary mt-4">
                  {application.status === 'REJECTED'
                    ? 'Fix & resubmit application'
                    : 'Continue application'}
                </Link>
              </div>
            )}

            {['PENDING_APPROVAL', 'SUBMITTED'].includes(application.status) && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Submitted {formatDate(application.submittedAt)} — awaiting admin review.
                We'll notify you as soon as it's decided.
              </p>
            )}

            {application.status === 'APPROVED' && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link to="/id-card" className="btn-primary">
                  View my ID card
                </Link>
                {canRenew && (
                  <button onClick={renew} disabled={renewBusy} className="btn-secondary">
                    {renewBusy
                      ? 'Renewing…'
                      : daysLeft < 0
                        ? 'Membership expired — renew now'
                        : `Renew (${daysLeft} days left)`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {QUICK_LINKS.map(([to, Icon, label]) => (
          <Link key={to} to={to} className="card text-center transition hover:shadow-md">
            <Icon className="mx-auto h-7 w-7 text-brand-700" />
            <div className="mt-2 text-sm font-semibold text-slate-700">{label}</div>
          </Link>
        ))}
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold">Recent notifications</h2>
        {(notifications || []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="py-2.5 text-sm">
                <div className="text-slate-700">{n.content}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {formatDateTime(n.createdAt)} · {n.channel}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
