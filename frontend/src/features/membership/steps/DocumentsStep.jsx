import DocumentsManager from '../../documents/DocumentsManager';

export default function DocumentsStep({ onNext, locked }) {
  return (
    <div className="space-y-6">
      <DocumentsManager locked={locked} />
      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
