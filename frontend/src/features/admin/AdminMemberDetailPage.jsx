import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Badge, ErrorText, Spinner, SuccessText } from '../../components/ui';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';
import { formatDate, formatDateTime } from '../../lib/format';

export default function AdminMemberDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState('');
  const [months, setMonths] = useState(12);
  const [cert, setCert] = useState({ title: '', issuingBody: '', issueDate: '' });
  const [certFile, setCertFile] = useState(null);

  const { data: member, isLoading } = useQuery({
    queryKey: ['admin', 'member', id],
    queryFn: async () => (await api.get(`/admin/members/${id}`)).data.data,
  });

  if (isLoading || !member) return <Spinner />;

  const latestApp = member.membershipApplications[0];
  const isSelf = me && me.id === member.id;

  const act = async (fn, successMessage) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      if (successMessage) setInfo(successMessage);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status) =>
    act(() => api.patch(`/admin/members/${id}/status`, { status }), `Status set to ${status}`);
  const changeRole = () =>
    act(() => api.patch(`/admin/members/${id}/role`, { role }), `Role set to ${role}`);
  const resetPassword = () =>
    act(
      () => api.post(`/admin/members/${id}/reset-password`),
      'Password reset code sent to the member'
    );
  const renew = () =>
    act(
      () => api.patch(`/admin/members/${id}/renew`, { months: Number(months) }),
      'Membership renewed'
    );
  const issueCert = () =>
    act(async () => {
      const form = new FormData();
      form.append('title', cert.title);
      form.append('issuingBody', cert.issuingBody);
      form.append('issueDate', cert.issueDate);
      if (certFile) form.append('certificate', certFile);
      await api.post(`/admin/members/${id}/certifications`, form);
      setCert({ title: '', issuingBody: '', issueDate: '' });
      setCertFile(null);
    }, 'Certification issued');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/members" className="text-sm font-semibold text-brand-700">
            ← Members
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {member.memberProfile
              ? `${member.memberProfile.firstName || ''} ${member.memberProfile.lastName || ''}`
              : member.phoneNumber}
          </h1>
          <p className="text-sm text-slate-500">
            {member.phoneNumber} · {member.email} · joined {formatDate(member.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={member.status} />
          <span className="badge bg-navy text-white">{member.role}</span>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      <SuccessText>{info}</SuccessText>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Membership</h2>
          {latestApp ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge status={latestApp.status} />
                <span className="capitalize">{latestApp.category.toLowerCase()}</span>
                {latestApp.expiresAt && <span>· until {formatDate(latestApp.expiresAt)}</span>}
              </div>
              {latestApp.idCard && (
                <div className="mt-2 text-sm text-slate-500">
                  Card {latestApp.idCard.cardNumber} <Badge status={latestApp.idCard.status} />
                </div>
              )}
              <Link
                to={`/admin/applications/${latestApp.id}`}
                className="btn-secondary mt-3"
              >
                Open application
              </Link>
              {latestApp.status === 'APPROVED' && (
                <div className="mt-4 flex items-end gap-3 border-t border-slate-100 pt-4">
                  <Field label="Extend by (months)">
                    <input
                      className="input w-28"
                      type="number"
                      min={1}
                      max={60}
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                    />
                  </Field>
                  <button className="btn-primary" onClick={renew} disabled={busy}>
                    Renew membership
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">No membership application.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Account actions</h2>
          <div className="flex flex-wrap gap-2">
            {member.status !== 'ACTIVE' && (
              <button className="btn-primary" disabled={busy || isSelf} onClick={() => changeStatus('ACTIVE')}>
                Reactivate
              </button>
            )}
            {member.status === 'ACTIVE' && (
              <button className="btn-secondary" disabled={busy || isSelf} onClick={() => changeStatus('SUSPENDED')}>
                Suspend
              </button>
            )}
            {member.status !== 'DEACTIVATED' && (
              <button className="btn-danger" disabled={busy || isSelf} onClick={() => changeStatus('DEACTIVATED')}>
                Deactivate (remove)
              </button>
            )}
            <button className="btn-secondary" disabled={busy} onClick={resetPassword}>
              Send password reset
            </button>
          </div>
          {isSelf && (
            <p className="mt-2 text-xs text-slate-400">
              You cannot change your own status or role.
            </p>
          )}

          {me && me.role === 'SUPER_ADMIN' && !isSelf && (
            <div className="mt-4 flex items-end gap-3 border-t border-slate-100 pt-4">
              <Field label="Change role">
                <select className="input w-44" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </Field>
              <button className="btn-primary" disabled={!role || busy} onClick={changeRole}>
                Update role
              </button>
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Certifications</h2>
          {(member.certifications || []).length === 0 ? (
            <p className="text-sm text-slate-400">None issued yet.</p>
          ) : (
            <ul className="mb-4 divide-y divide-slate-100">
              {member.certifications.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <b>{c.title}</b> — {c.issuingBody} · {formatDate(c.issueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Title" required>
              <input
                className="input"
                value={cert.title}
                onChange={(e) => setCert({ ...cert, title: e.target.value })}
              />
            </Field>
            <Field label="Issuing body" required>
              <input
                className="input"
                value={cert.issuingBody}
                onChange={(e) => setCert({ ...cert, issuingBody: e.target.value })}
              />
            </Field>
            <Field label="Issue date" required>
              <input
                className="input"
                type="date"
                value={cert.issueDate}
                onChange={(e) => setCert({ ...cert, issueDate: e.target.value })}
              />
            </Field>
            <Field label="Certificate file (optional)">
              <FileUpload file={certFile} onSelect={setCertFile} />
            </Field>
          </div>
          <button
            className="btn-primary mt-3"
            disabled={busy || !cert.title || !cert.issuingBody || !cert.issueDate}
            onClick={issueCert}
          >
            Issue certification
          </button>
        </div>
      </div>
    </div>
  );
}
