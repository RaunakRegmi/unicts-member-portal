import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ErrorText, PageHeader, Spinner, SuccessText } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function CalendarPage() {
  const [params] = useSearchParams();
  const justConnected = params.get('connected') === '1';
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(justConnected ? 'Google Calendar connected!' : null);
  const [busy, setBusy] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: async () => (await api.get('/members/me/calendar/status')).data.data,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: async () => (await api.get('/events?filter=upcoming')).data.data,
  });

  const connect = async () => {
    setError(null);
    try {
      const { data } = await api.get('/members/me/calendar/auth-url');
      window.location.href = data.data.url;
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const sync = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/members/me/calendar/sync');
      setInfo(`Synced ${data.data.synced} of ${data.data.total} upcoming events to your Google Calendar.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const byMonth = (events || []).reduce((acc, event) => {
    const month = new Date(event.startDatetime).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
    (acc[month] = acc[month] || []).push(event);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="UNICTS events — in the portal and in your Google Calendar"
        action={
          status && status.configured ? (
            status.connected ? (
              <button onClick={sync} disabled={busy} className="btn-primary">
                {busy ? 'Syncing…' : 'Sync to Google Calendar'}
              </button>
            ) : (
              <button onClick={connect} className="btn-primary">
                Connect Google Calendar
              </button>
            )
          ) : null
        }
      />

      <ErrorText>{error}</ErrorText>
      <SuccessText>{info}</SuccessText>
      {status && !status.configured && (
        <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-500">
          Google Calendar sync isn't configured on this server yet — events are always
          visible below either way.
        </p>
      )}

      {isLoading && <Spinner />}

      {Object.keys(byMonth).length === 0 && !isLoading && (
        <p className="text-sm text-slate-400">No upcoming events.</p>
      )}

      <div className="mt-2 space-y-6">
        {Object.entries(byMonth).map(([month, monthEvents]) => (
          <div key={month}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
              {month}
            </h2>
            <div className="space-y-2">
              {monthEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="card flex items-center gap-4 py-4 transition hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-800">
                    <span className="text-lg font-bold leading-none">
                      {new Date(event.startDatetime).getDate()}
                    </span>
                    <span className="text-[10px] uppercase">
                      {new Date(event.startDatetime).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">{event.title}</div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(event.startDatetime)}
                      {event.location && <> · {event.location}</>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
