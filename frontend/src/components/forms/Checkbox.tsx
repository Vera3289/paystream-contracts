import React from 'react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helpText?: string;
  error?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, helpText, error, id, className, disabled }) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field form-field--checkbox ${className ?? ''}`}>
      <label htmlFor={fieldId} className="form-field__checkbox-label">
        <input id={fieldId} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="form-field__checkbox" aria-describedby={helpText || error ? `${fieldId}-hint` : undefined} />
        {label}
      </label>
      {(helpText || error) && (
        <span id={`${fieldId}-hint`} className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
      )}
    </div>
  );
};
