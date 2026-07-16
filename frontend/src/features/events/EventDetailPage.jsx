import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock, MapPin, Users } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ErrorText, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

export default function EventDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api.get(`/events/${id}`)).data.data,
  });

  if (isLoading || !event) return <Spinner />;

  const isPast = new Date(event.endDatetime) < new Date();

  const rsvp = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/events/${id}/rsvp`);
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/events" className="text-sm font-semibold text-brand-700">
        ← All events
      </Link>

      <div className="card mt-4 overflow-hidden p-0">
        {event.bannerImageUrl ? (
          <img src={event.bannerImageUrl} alt="" className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-navy to-brand-800">
            <CalendarDays className="h-14 w-14 text-white/70" />
          </div>
        )}
        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
          <div className="mt-2 space-y-1 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              {formatDateTime(event.startDatetime)} — {formatDateTime(event.endDatetime)}
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {event.location}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              {event.registrationCount} registered
            </div>
          </div>

          <p className="mt-4 whitespace-pre-line text-slate-700">{event.description}</p>

          <div className="mt-6">
            <ErrorText>{error}</ErrorText>
            {event.isRegistered ? (
              <span className="badge gap-1 bg-emerald-100 px-4 py-2 text-emerald-800">
                You're registered <Check className="h-3.5 w-3.5" />
              </span>
            ) : isPast ? (
              <span className="text-sm text-slate-400">This event has ended.</span>
            ) : (
              <button onClick={rsvp} disabled={busy} className="btn-primary">
                {busy ? 'Registering…' : 'RSVP — I’ll attend'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
