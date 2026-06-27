import React from 'react';

interface FileUploadProps {
  label: string;
  onChange: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  helpText?: string;
  error?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onChange, accept, multiple, helpText, error, id, className, disabled }) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field ${className ?? ''}`}>
      <label htmlFor={fieldId} className="form-field__label">{label}</label>
      <input id={fieldId} type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={e => onChange(e.target.files)} className={`form-field__file${error ? ' form-field__file--error' : ''}`} aria-describedby={helpText || error ? `${fieldId}-hint` : undefined} />
      {(helpText || error) && (
        <span id={`${fieldId}-hint`} className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
      )}
    </div>
  );
};
