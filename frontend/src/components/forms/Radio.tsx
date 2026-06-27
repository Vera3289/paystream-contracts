import React from 'react';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioProps {
  label: string;
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  error?: string;
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({ label, name, options, value, onChange, helpText, error, className }) => (
  <fieldset className={`form-field form-field--radio ${className ?? ''}`}>
    <legend className="form-field__label">{label}</legend>
    {options.map(opt => (
      <label key={opt.value} className="form-field__radio-label">
        <input type="radio" name={name} value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} className="form-field__radio" />
        {opt.label}
      </label>
    ))}
    {(helpText || error) && (
      <span className={error ? 'form-field__error' : 'form-field__help'}>{error ?? helpText}</span>
    )}
  </fieldset>
);
