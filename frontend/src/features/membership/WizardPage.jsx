import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApplication } from '../../lib/hooks';
import { FullPageSpinner, EmptyState, Badge } from '../../components/ui';
import ProgressBar from '../../components/ProgressBar';
import Stepper from '../../components/Stepper';
import DomainStep from './steps/DomainStep';
import PersonalStep from './steps/PersonalStep';
import AddressStep from './steps/AddressStep';
import WorkStep from './steps/WorkStep';
import DocumentsStep from './steps/DocumentsStep';
import CvStep from './steps/CvStep';
import InstitutionalStep from './steps/InstitutionalStep';
import ReviewStep from './steps/ReviewStep';

const BASE_STEPS = [
  { key: 'domain', label: 'Domain' },
  { key: 'personal', label: 'Personal' },
  { key: 'address', label: 'Address' },
  { key: 'work', label: 'Education & Work' },
  { key: 'documents', label: 'Documents' },
  { key: 'cv', label: 'CV' },
  { key: 'review', label: 'Review & Submit' },
];

const STEP_COMPONENTS = {
  domain: DomainStep,
  personal: PersonalStep,
  address: AddressStep,
  work: WorkStep,
  documents: DocumentsStep,
  cv: CvStep,
  institutional: InstitutionalStep,
  review: ReviewStep,
};

export default function WizardPage() {
  const { step } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useApplication();

  if (isLoading) return <FullPageSpinner />;

  const application = data && data.application;
  if (!application) {
    return (
      <EmptyState
        title="No application yet"
        subtitle="Pick a membership category to start your application."
        action={
          <Link to="/apply" className="btn-primary">
            Choose category
          </Link>
        }
      />
    );
  }

  const steps = [...BASE_STEPS];
  if (application.category === 'INSTITUTIONAL') {
    steps.splice(6, 0, { key: 'institutional', label: 'Business' });
  }

  const activeIndex = steps.findIndex((s) => s.key === step);
  if (activeIndex === -1) {
    return <Navigate to="/membership/wizard/domain" replace />;
  }

  const completion = data.completion || { sections: [], percent: 0 };
  const complete = Object.fromEntries(completion.sections.map((s) => [s.key, s.complete]));
  const stepsWithState = steps.map((s) => ({
    ...s,
    complete:
      s.key === 'domain'
        ? false
        : s.key === 'work'
          ? Boolean(complete.education && complete.employment)
          : s.key === 'review'
            ? completion.percent === 100
            : Boolean(complete[s.key]),
  }));

  const goNext = () => {
    const next = steps[activeIndex + 1];
    navigate(next ? `/membership/wizard/${next.key}` : '/dashboard');
  };

  const locked = ['PENDING_APPROVAL', 'SUBMITTED'].includes(application.status);
  const StepComponent = STEP_COMPONENTS[step];

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Membership application</h1>
            <p className="text-sm text-slate-500">
              {application.category === 'INSTITUTIONAL' ? 'Institutional' : 'General'} ·{' '}
              {application.membershipGroup && application.membershipGroup.name} group
            </p>
          </div>
          <Badge status={application.status} />
        </div>
        <div className="mt-4">
          <ProgressBar percent={completion.percent} />
        </div>
        <div className="mt-4">
          <Stepper
            steps={stepsWithState}
            activeKey={step}
            onSelect={(key) => navigate(`/membership/wizard/${key}`)}
          />
        </div>
      </div>

      {application.status === 'REJECTED' && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <b>Your application was not approved.</b>
          {application.rejectionReason && <> Reason: {application.rejectionReason}.</>}{' '}
          Update the sections below and submit again from the Review step.
        </div>
      )}
      {locked && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your application is <b>under review</b> — the form is locked until an admin
          completes the review.
        </div>
      )}

      <StepComponent onNext={goNext} application={application} locked={locked} />
    </div>
  );
}
