import { Check } from 'lucide-react';

export default function Stepper({ steps, activeKey, onSelect }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const isActive = step.key === activeKey;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => onSelect && onSelect(step.key)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : step.complete
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? 'bg-white text-brand-700'
                    : step.complete
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step.complete && !isActive ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
