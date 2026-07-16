import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function CertificationsPage() {
  const { data: certifications, isLoading } = useQuery({
    queryKey: ['certifications'],
    queryFn: async () => (await api.get('/members/me/certifications')).data.data,
  });

  return (
    <div>
      <PageHeader
        title="Certifications"
        subtitle="Issued to you by UNICTS for trainings and courses"
      />

      {isLoading && <Spinner />}
      {!isLoading && (certifications || []).length === 0 && (
        <EmptyState
          title="No certifications yet"
          subtitle="Certificates issued by UNICTS will appear here."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(certifications || []).map((cert) => (
          <div key={cert.id} className="card">
            <GraduationCap className="h-8 w-8 text-brand-700" />
            <h2 className="mt-2 font-semibold text-slate-900">{cert.title}</h2>
            <p className="text-sm text-slate-500">
              {cert.issuingBody} · {formatDate(cert.issueDate)}
            </p>
            {cert.certificateUrl && (
              <a
                href={cert.certificateUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary mt-4"
              >
                Download certificate
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
