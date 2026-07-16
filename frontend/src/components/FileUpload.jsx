import { useRef, useState } from 'react';

export default function FileUpload({
  label = 'Choose file',
  accept = 'image/jpeg,image/png,application/pdf',
  file,
  onSelect,
  previewUrl,
}) {
  const inputRef = useRef(null);
  const [localPreview, setLocalPreview] = useState(null);

  const handleChange = (e) => {
    const selected = e.target.files && e.target.files[0];
    if (!selected) return;
    if (selected.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(selected));
    } else {
      setLocalPreview(null);
    }
    onSelect(selected);
  };

  const shownPreview = localPreview || previewUrl;

  return (
    <div className="flex items-center gap-4">
      {shownPreview ? (
        <img
          src={shownPreview}
          alt="preview"
          className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
          No file
        </div>
      )}
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => inputRef.current && inputRef.current.click()}
        >
          {label}
        </button>
        {file && (
          <p className="mt-1 truncate text-xs text-slate-500">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
      </div>
    </div>
  );
}
