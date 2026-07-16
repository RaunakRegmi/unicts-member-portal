import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import { useProfile } from '../../../lib/hooks';
import Field from '../../../components/Field';
import { ErrorText } from '../../../components/ui';

const QUALIFICATIONS = ['SEE/SLC', '+2/Intermediate', "Bachelor's", "Master's", 'PhD', 'Other'];
const NATURE_OF_JOB = [
  ['permanent', 'Permanent'],
  ['contract', 'Contract'],
  ['temporary', 'Temporary'],
  ['self_employed', 'Self-employed'],
  ['student', 'Student'],
  ['unemployed', 'Unemployed'],
];
const SECTORS = [
  'IT/Software',
  'Banking & Finance',
  'Sales & Marketing',
  'Government',
  'Education',
  'Healthcare',
  'NGO/INGO',
  'Other',
];

export default function WorkStep({ onNext, locked }) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!profile) return;
    reset({
      highestQualification:
        (profile.educationDetail && profile.educationDetail.highestQualification) || '',
      institutionName:
        (profile.educationDetail && profile.educationDetail.institutionName) || '',
      fieldOfStudy: (profile.educationDetail && profile.educationDetail.fieldOfStudy) || '',
      organizationName:
        (profile.employmentDetail && profile.employmentDetail.organizationName) || '',
      designation: (profile.employmentDetail && profile.employmentDetail.designation) || '',
      natureOfJob: (profile.employmentDetail && profile.employmentDetail.natureOfJob) || '',
      organizationSector:
        (profile.employmentDetail && profile.employmentDetail.organizationSector) || '',
    });
  }, [profile, reset]);

  const onSubmit = async (values) => {
    setError(null);
    try {
      await api.patch('/members/me/education', {
        highestQualification: values.highestQualification,
        institutionName: values.institutionName || null,
        fieldOfStudy: values.fieldOfStudy || null,
      });
      await api.patch('/members/me/employment', {
        organizationName: values.organizationName || null,
        designation: values.designation || null,
        natureOfJob: values.natureOfJob,
        organizationSector: values.organizationSector,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      onNext();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Academic details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Highest qualification"
            required
            error={errors.highestQualification && 'Required'}
          >
            <select
              className="input"
              disabled={locked}
              {...register('highestQualification', { required: true })}
            >
              <option value="">Select…</option>
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Institution name">
            <input className="input" disabled={locked} {...register('institutionName')} />
          </Field>
          <Field label="Field of study">
            <input className="input" disabled={locked} {...register('fieldOfStudy')} />
          </Field>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Employment details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization / office name">
            <input className="input" disabled={locked} {...register('organizationName')} />
          </Field>
          <Field label="Designation">
            <input className="input" disabled={locked} {...register('designation')} />
          </Field>
          <Field label="Nature of job" required error={errors.natureOfJob && 'Required'}>
            <select className="input" disabled={locked} {...register('natureOfJob', { required: true })}>
              <option value="">Select…</option>
              {NATURE_OF_JOB.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Organization sector"
            required
            error={errors.organizationSector && 'Required'}
          >
            <select
              className="input"
              disabled={locked}
              {...register('organizationSector', { required: true })}
            >
              <option value="">Select…</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={isSubmitting || locked}>
          {isSubmitting ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </form>
  );
}
