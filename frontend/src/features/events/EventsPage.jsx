import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

const FILTERS = ['upcoming', 'ongoing', 'past'];

export default function EventsPage() {
  const [filter, setFilter] = useState('upcoming');
  const { data: events, isLoading } = useQuery({
    queryKey: ['events', filter],
    queryFn: async () => (await api.get(`/events?filter=${filter}`)).data.data,
  });

  return (
    <div>
      <PageHeader title="Events" subtitle="Talks, trainings, and meetups from UNICTS" />

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
              filter === f ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {!isLoading && (events || []).length === 0 && (
        <EmptyState title={`No ${filter} events`} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(events || []).map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="card overflow-hidden p-0 transition hover:shadow-md"
          >
            {event.bannerImageUrl ? (
              <img src={event.bannerImageUrl} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-navy to-brand-800">
                <CalendarDays className="h-10 w-10 text-white/70" />
              </div>
            )}
            <div className="p-5">
              <h2 className="font-semibold text-slate-900">{event.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(event.startDatetime)}
                {event.location && <> · {event.location}</>}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{event.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {event.registrationCount} registered
                </span>
                {event.isRegistered && (
                  <span className="badge gap-1 bg-emerald-100 text-emerald-800">
                    Registered <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
