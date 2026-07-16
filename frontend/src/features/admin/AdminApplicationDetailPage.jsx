import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Badge, ErrorText, Modal, Spinner } from '../../components/ui';
import { formatDate, formatDateTime, statusLabel } from '../../lib/format';

function Section({ title, children }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-700">{value || '—'}</dd>
    </div>
  );
}

function DocLink({ url, label }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700">
      {label} ↗
    </a>
  );
}

export default function AdminApplicationDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: app, isLoading } = useQuery({
    queryKey: ['admin', 'application', id],
    queryFn: async () => (await api.get(`/admin/applications/${id}`)).data.data,
  });

  if (isLoading || !app) return <Spinner />;

  const profile = app.user.memberProfile || {};
  const reviewable = ['SUBMITTED', 'PENDING_APPROVAL'].includes(app.status);

  const act = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const approve = () => act(() => api.patch(`/admin/applications/${id}/approve`));
  const reject = () =>
    act(async () => {
      await api.patch(`/admin/applications/${id}/reject`, { reason });
      setRejectOpen(false);
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/applications" className="text-sm font-semibold text-brand-700">
            ← Applications
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {statusLabel(app.category)} · {app.membershipGroup && app.membershipGroup.name} group ·
            submitted {formatDateTime(app.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge status={app.status} />
          {reviewable && (
            <>
              <button onClick={approve} disabled={busy} className="btn-primary">
                {busy ? 'Working…' : 'Approve'}
              </button>
              <button onClick={() => setRejectOpen(true)} disabled={busy} className="btn-danger">
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {app.status === 'REJECTED' && app.rejectionReason && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          Rejected: {app.rejectionReason}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Applicant">
          <div className="flex items-start gap-4">
            {profile.profilePictureUrl ? (
              <img
                src={profile.profilePictureUrl}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                No photo
              </div>
            )}
            <dl className="grid flex-1 grid-cols-2 gap-3">
              <KV label="Phone" value={app.user.phoneNumber} />
              <KV label="Email" value={app.user.email} />
              <KV label="Date of birth" value={profile.dob && formatDate(profile.dob)} />
              <KV label="Gender" value={profile.gender} />
              <KV label="Blood group" value={profile.bloodGroup} />
              <KV label="ICT domain" value={profile.ictDomain && profile.ictDomain.name} />
              <KV
                label="Emergency contact"
                value={
                  profile.emergencyContactName &&
                  `${profile.emergencyContactName} (${profile.emergencyContactPhone || '—'})`
                }
              />
              <KV
                label="Social profile"
                value={
                  profile.socialProfileUrl && (
                    <a
                      href={profile.socialProfileUrl}
                      className="text-brand-700"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profile.socialProfileUrl}
                    </a>
                  )
                }
              />
            </dl>
          </div>
          {profile.signatureUrl && (
            <div className="mt-4">
              <div className="text-xs text-slate-400">Signature</div>
              <img
                src={profile.signatureUrl}
                alt="signature"
                className="mt-1 h-12 rounded border border-slate-200 bg-white px-2 object-contain"
              />
            </div>
          )}
        </Section>

        <Section title="Addresses">
          {(profile.addresses || []).map((address) => (
            <div key={address.id} className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-700">
                {statusLabel(address.type)}
                {address.sameAsPermanent && (
                  <span className="ml-2 text-xs text-slate-400">(same as permanent)</span>
                )}
              </div>
              <div className="text-slate-600">
                {address.tole}, {address.municipality}-{address.wardNumber},{' '}
                {address.district}, {address.province}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Education & Employment">
          <dl className="grid grid-cols-2 gap-3">
            <KV
              label="Highest qualification"
              value={profile.educationDetail && profile.educationDetail.highestQualification}
            />
            <KV
              label="Institution"
              value={profile.educationDetail && profile.educationDetail.institutionName}
            />
            <KV
              label="Field of study"
              value={profile.educationDetail && profile.educationDetail.fieldOfStudy}
            />
            <KV
              label="Organization"
              value={profile.employmentDetail && profile.employmentDetail.organizationName}
            />
            <KV
              label="Designation"
              value={profile.employmentDetail && profile.employmentDetail.designation}
            />
            <KV
              label="Nature of job"
              value={
                profile.employmentDetail && statusLabel(profile.employmentDetail.natureOfJob)
              }
            />
            <KV
              label="Sector"
              value={profile.employmentDetail && profile.employmentDetail.organizationSector}
            />
          </dl>
        </Section>

        <Section title="Identity documents">
          {(profile.identityDocuments || []).length === 0 && (
            <p className="text-sm text-slate-400">None uploaded.</p>
          )}
          <ul className="space-y-3">
            {(profile.identityDocuments || []).map((doc) => (
              <li key={doc.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{statusLabel(doc.documentType)}</span>
                  <Badge status={doc.verificationStatus} />
                </div>
                <div className="text-xs text-slate-500">No. {doc.documentNumber}</div>
                <div className="mt-1 flex gap-3">
                  <DocLink url={doc.frontImageUrl} label="Front" />
                  <DocLink url={doc.backImageUrl} label="Back" />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="CV">
          {(profile.cvDocuments || []).length === 0 && (
            <p className="text-sm text-slate-400">None.</p>
          )}
          <ul className="space-y-2">
            {(profile.cvDocuments || []).map((cv) => (
              <li key={cv.id} className="flex items-center justify-between text-sm">
                <span>
                  {cv.sourceType === 'GENERATED'
                    ? `Generated${cv.template ? ` · ${cv.template.name}` : ''}`
                    : 'Uploaded'}{' '}
                  <span className="text-xs text-slate-400">{formatDateTime(cv.createdAt)}</span>
                </span>
                <DocLink url={cv.fileUrl} label="Open" />
              </li>
            ))}
          </ul>
        </Section>

        {app.institutionalDetail && (
          <Section title="Business verification (institutional)">
            <dl className="grid grid-cols-2 gap-3">
              <KV label="Business name" value={app.institutionalDetail.businessName} />
              <KV
                label="Registration no."
                value={app.institutionalDetail.businessRegistrationNumber}
              />
              <KV label="VAT/PAN no." value={app.institutionalDetail.vatOrPanNumber} />
            </dl>
            <div className="mt-3 flex gap-4">
              <DocLink
                url={app.institutionalDetail.businessRegistrationDocUrl}
                label="Registration document"
              />
              <DocLink url={app.institutionalDetail.vatOrPanDocUrl} label="VAT/PAN document" />
            </div>
          </Section>
        )}

        <Section title="Payment & card">
          <dl className="grid grid-cols-2 gap-3">
            <KV
              label="Payment"
              value={
                app.payment && (
                  <>
                    NPR {app.payment.amount} <Badge status={app.payment.status} />
                  </>
                )
              }
            />
            <KV
              label="ID card"
              value={
                app.idCard && (
                  <>
                    {app.idCard.cardNumber} <Badge status={app.idCard.status} />
                  </>
                )
              }
            />
            {app.idCard && app.idCard.pdfUrl && (
              <DocLink url={app.idCard.pdfUrl} label="Card PDF" />
            )}
          </dl>
        </Section>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject application"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </button>
            <button className="btn-danger" disabled={reason.trim().length < 3 || busy} onClick={reject}>
              {busy ? 'Rejecting…' : 'Reject application'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          The applicant sees this reason and can edit + resubmit their application.
        </p>
        <textarea
          className="input mt-3 min-h-[100px]"
          placeholder="Reason for rejection…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
