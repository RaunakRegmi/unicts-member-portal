import { PageHeader } from '../../components/ui';
import { useApplication } from '../../lib/hooks';
import DocumentsManager from './DocumentsManager';

export default function DocumentsPage() {
  const { data } = useApplication();
  const locked = Boolean(
    data &&
      data.application &&
      ['PENDING_APPROVAL', 'SUBMITTED'].includes(data.application.status)
  );

  return (
    <div>
      <PageHeader
        title="My documents"
        subtitle="Profile photo, signature, and identity documents"
      />
      <DocumentsManager locked={locked} />
    </div>
  );
}
