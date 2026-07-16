import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '../../../lib/apiClient';
import { useProfile } from '../../../lib/hooks';
import Field from '../../../components/Field';
import { ErrorText } from '../../../components/ui';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Self-describe'];

export default function PersonalStep({ onNext, locked }) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const gender = watch('gender');

  useEffect(() => {
    if (!profile) return;
    reset({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dob: profile.dob ? profile.dob.slice(0, 10) : '',
      gender: GENDERS.includes(profile.gender) ? profile.gender : profile.gender ? 'Self-describe' : '',
      genderCustom: GENDERS.includes(profile.gender) ? '' : profile.gender || '',
      bloodGroup: profile.bloodGroup || '',
      mobileNumber: profile.mobileNumber || '',
      workplaceTelephone: profile.workplaceTelephone || '',
      socialProfileUrl: profile.socialProfileUrl || '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactPhone: profile.emergencyContactPhone || '',
    });
  }, [profile, reset]);

  const onSubmit = async (values) => {
    setError(null);
    try {
      await api.patch('/members/me/profile', {
        firstName: values.firstName,
        lastName: values.lastName,
        dob: values.dob || undefined,
        gender: values.gender === 'Self-describe' ? values.genderCustom : values.gender,
        bloodGroup: values.bloodGroup || null,
        mobileNumber: values.mobileNumber,
        workplaceTelephone: values.workplaceTelephone || null,
        socialProfileUrl: values.socialProfileUrl || null,
        emergencyContactName: values.emergencyContactName || null,
        emergencyContactPhone: values.emergencyContactPhone || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['application'] });
      onNext();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
      <h2 className="text-lg font-semibold">Personal details</h2>
      <ErrorText>{error}</ErrorText>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName && 'Required'}>
          <input className="input" disabled={locked} {...register('firstName', { required: true })} />
        </Field>
        <Field label="Last name" required error={errors.lastName && 'Required'}>
          <input className="input" disabled={locked} {...register('lastName', { required: true })} />
        </Field>
        <Field label="Date of birth" required error={errors.dob && 'Required'}>
          <input className="input" type="date" disabled={locked} {...register('dob', { required: true })} />
        </Field>
        <Field label="Gender" required error={errors.gender && 'Required'}>
          <select className="input" disabled={locked} {...register('gender', { required: true })}>
            <option value="">Select…</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        {gender === 'Self-describe' && (
          <Field label="Describe your gender">
            <input className="input" disabled={locked} {...register('genderCustom')} />
          </Field>
        )}
        <Field label="Blood group" hint="Shown on your ID card">
          <select className="input" disabled={locked} {...register('bloodGroup')}>
            <option value="">Select…</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mobile number" required error={errors.mobileNumber && 'Required'}>
          <input className="input" disabled={locked} {...register('mobileNumber', { required: true })} />
        </Field>
        <Field label="Workplace telephone">
          <input className="input" disabled={locked} {...register('workplaceTelephone')} />
        </Field>
        <Field label="LinkedIn / social profile URL" hint="Linked from your ID card's verification page">
          <input
            className="input"
            placeholder="https://linkedin.com/in/…"
            disabled={locked}
            {...register('socialProfileUrl')}
          />
        </Field>
        <Field label="Emergency contact name">
          <input className="input" disabled={locked} {...register('emergencyContactName')} />
        </Field>
        <Field label="Emergency contact phone">
          <input className="input" disabled={locked} {...register('emergencyContactPhone')} />
        </Field>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={isSubmitting || locked}>
          {isSubmitting ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </form>
  );
}
