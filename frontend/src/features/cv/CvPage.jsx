import { PageHeader } from '../../components/ui';
import { useApplication } from '../../lib/hooks';
import CvManager from './CvManager';

export default function CvPage() {
  const { data } = useApplication();
  const locked = Boolean(
    data &&
      data.application &&
      ['PENDING_APPROVAL', 'SUBMITTED'].includes(data.application.status)
  );

  return (
    <div>
      <PageHeader
        title="My CV"
        subtitle="Upload an existing CV or generate one from your profile"
      />
      <CvManager locked={locked} />
    </div>
  );
}
