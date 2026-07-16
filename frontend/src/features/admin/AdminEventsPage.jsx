import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { EmptyState, ErrorText, Modal, PageHeader, Spinner } from '../../components/ui';
import Field from '../../components/Field';
import FileUpload from '../../components/FileUpload';
import { formatDateTime } from '../../lib/format';

const EMPTY_FORM = { title: '', description: '', startDatetime: '', endDatetime: '', location: '' };

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [banner, setBanner] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: async () => (await api.get('/events')).data.data,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setBanner(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime.slice(0, 16),
      endDatetime: event.endDatetime.slice(0, 16),
      location: event.location || '',
    });
    setBanner(null);
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) body.append(key, key.includes('Datetime') ? new Date(value).toISOString() : value);
      });
      if (banner) body.append('banner', banner);

      if (editing) await api.patch(`/admin/events/${editing.id}`, body);
      else await api.post('/admin/events', body);

      await queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      setModalOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? Registrations are removed too.`)) return;
    try {
      await api.delete(`/admin/events/${event.id}`);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Create and manage society events"
        action={
          <button className="btn-primary" onClick={openCreate}>
            + New event
          </button>
        }
      />
      <ErrorText>{error}</ErrorText>

      {isLoading && <Spinner />}
      {!isLoading && (events || []).length === 0 && <EmptyState title="No events yet" />}

      <div className="space-y-3">
        {(events || []).map((event) => (
          <div key={event.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">{event.title}</div>
              <div className="text-xs text-slate-500">
                {formatDateTime(event.startDatetime)} — {formatDateTime(event.endDatetime)}
                {event.location && <> · {event.location}</>} · {event.registrationCount}{' '}
                registered
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => openEdit(event)}>
                Edit
              </button>
              <button className="btn-danger" onClick={() => remove(event)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit event' : 'New event'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !form.title || !form.description || !form.startDatetime || !form.endDatetime}
              onClick={save}
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description" required>
            <textarea
              className="input min-h-[100px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" required>
              <input
                className="input"
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) => setForm({ ...form, startDatetime: e.target.value })}
              />
            </Field>
            <Field label="Ends" required>
              <input
                className="input"
                type="datetime-local"
                value={form.endDatetime}
                onChange={(e) => setForm({ ...form, endDatetime: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Location">
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Banner image (optional)">
            <FileUpload accept="image/jpeg,image/png" file={banner} onSelect={setBanner} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
