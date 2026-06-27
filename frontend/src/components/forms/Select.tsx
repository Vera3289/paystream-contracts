import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  helpText?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, helpText, error, id, className, ...props }) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field ${className ?? ''}`}>
      <label htmlFor={fieldId} className="form-field__label">{label}</label>
      <select id={fieldId} className={`form-field__select${error ? ' form-field__select--error' : ''}`} aria-describedby={helpText || error ? `${fieldId}-hint` : undefined} {...props}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {(helpText || error) && (
        <span id={`${fieldId}-hint`} className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
      )}
    </div>
  );
};
