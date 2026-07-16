import CvManager from '../../cv/CvManager';

export default function CvStep({ onNext, locked }) {
  return (
    <div className="space-y-6">
      <CvManager locked={locked} />
      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
