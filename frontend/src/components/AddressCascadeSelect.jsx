import { useAddressData } from '../lib/hooks';
import Field from './Field';

// Cascading Province → District → Municipality selects backed by the full
// 7/77/753 Nepal administrative-division dataset served by the API.
export default function AddressCascadeSelect({ value, onChange, errors = {} }) {
  const { data } = useAddressData();
  const provinces = (data && data.provinces) || [];

  const province = provinces.find((p) => p.name === value.province);
  const districts = (province && province.districts) || [];
  const district = districts.find((d) => d.name === value.district);
  const municipalities = (district && district.municipalities) || [];

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Province" required error={errors.province}>
        <select
          className="input"
          value={value.province || ''}
          onChange={(e) => set({ province: e.target.value, district: '', municipality: '' })}
        >
          <option value="">Select province…</option>
          {provinces.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="District" required error={errors.district}>
        <select
          className="input"
          value={value.district || ''}
          disabled={!value.province}
          onChange={(e) => set({ district: e.target.value, municipality: '' })}
        >
          <option value="">Select district…</option>
          {districts.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Municipality / Rural Municipality" required error={errors.municipality}>
        {municipalities.length > 0 ? (
          <select
            className="input"
            value={value.municipality || ''}
            disabled={!value.district}
            onChange={(e) => set({ municipality: e.target.value })}
          >
            <option value="">Select municipality…</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            placeholder="Municipality"
            value={value.municipality || ''}
            disabled={!value.district}
            onChange={(e) => set({ municipality: e.target.value })}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ward No." required error={errors.wardNumber}>
          <input
            className="input"
            inputMode="numeric"
            maxLength={2}
            placeholder="e.g. 4"
            value={value.wardNumber || ''}
            onChange={(e) => set({ wardNumber: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
        <Field label="Tole / Street" required error={errors.tole}>
          <input
            className="input"
            placeholder="Tole"
            value={value.tole || ''}
            onChange={(e) => set({ tole: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
