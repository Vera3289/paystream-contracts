import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helpText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, helpText, error, id, className, rows = 4, ...props }) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field ${className ?? ''}`}>
      <label htmlFor={fieldId} className="form-field__label">{label}</label>
      <textarea id={fieldId} rows={rows} className={`form-field__textarea${error ? ' form-field__textarea--error' : ''}`} aria-describedby={helpText || error ? `${fieldId}-hint` : undefined} {...props} />
      {(helpText || error) && (
        <span id={`${fieldId}-hint`} className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
      )}
    </div>
  );
};
