import React from 'react';

interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helpText?: string;
  error?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, helpText, error, id, className, ...props }) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field ${className ?? ''}`}>
      <label htmlFor={fieldId} className="form-field__label">{label}</label>
      <input id={fieldId} type="date" className={`form-field__input${error ? ' form-field__input--error' : ''}`} aria-describedby={helpText || error ? `${fieldId}-hint` : undefined} {...props} />
      {(helpText || error) && (
        <span id={`${fieldId}-hint`} className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
      )}
    </div>
  );
};
