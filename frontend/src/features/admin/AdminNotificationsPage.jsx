import { useState } from 'react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ErrorText, PageHeader, SuccessText } from '../../components/ui';
import Field from '../../components/Field';

const AUDIENCES = [
  ['USER', 'A single member'],
  ['ALL_ACTIVE_MEMBERS', 'All active members'],
  ['PENDING_APPLICANTS', 'Applicants awaiting review'],
];

export default function AdminNotificationsPage() {
  const [audience, setAudience] = useState('ALL_ACTIVE_MEMBERS');
  const [channel, setChannel] = useState('SMS');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const searchMembers = async () => {
    setError(null);
    try {
      const { data } = await api.get('/admin/members', {
        params: { search: memberQuery, pageSize: 8 },
      });
      setMemberResults(data.data.items);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const send = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { data } = await api.post('/admin/notifications/send', {
        audience,
        userId: audience === 'USER' ? selectedUser && selectedUser.id : undefined,
        channel,
        subject: subject || undefined,
        message,
      });
      setInfo(`Queued for ${data.data.queued} recipient(s).`);
      setMessage('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Send SMS, email, or in-app messages to members"
      />

      <div className="card max-w-2xl space-y-4">
        <ErrorText>{error}</ErrorText>
        <SuccessText>{info}</SuccessText>

        <Field label="Audience" required>
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {audience === 'USER' && (
          <Field label="Member" required>
            {selectedUser ? (
              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
                <span>
                  {selectedUser.memberProfile
                    ? `${selectedUser.memberProfile.firstName || ''} ${selectedUser.memberProfile.lastName || ''}`
                    : selectedUser.phoneNumber}{' '}
                  · {selectedUser.phoneNumber}
                </span>
                <button className="text-xs font-semibold text-rose-600" onClick={() => setSelectedUser(null)}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Search name, phone, email…"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                  />
                  <button className="btn-secondary" onClick={searchMembers} disabled={!memberQuery}>
                    Search
                  </button>
                </div>
                {memberResults.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {memberResults.map((user) => (
                      <li key={user.id}>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => setSelectedUser(user)}
                        >
                          {user.memberProfile
                            ? `${user.memberProfile.firstName || ''} ${user.memberProfile.lastName || ''}`
                            : '—'}{' '}
                          · {user.phoneNumber} · {user.email}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Field>
        )}

        <Field label="Channel" required>
          <div className="flex gap-5 text-sm">
            {['SMS', 'EMAIL', 'IN_APP'].map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={channel === c}
                  onChange={() => setChannel(c)}
                />
                {c.replaceAll('_', '-')}
              </label>
            ))}
          </div>
        </Field>

        {channel === 'EMAIL' && (
          <Field label="Subject">
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        )}

        <Field label="Message" required>
          <textarea
            className="input min-h-[120px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>

        <button
          className="btn-primary"
          disabled={busy || !message || (audience === 'USER' && !selectedUser)}
          onClick={send}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
