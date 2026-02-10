import React, { useState, useRef, useEffect } from 'react';
import './RichSelect.css';

export interface RichSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface RichSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: RichSelectOption[];
  placeholder?: string;
  className?: string;
}

export const RichSelect: React.FC<RichSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={`rich-select-wrapper ${className}`} ref={wrapperRef}>
      <div
        className={`rich-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
      >
        {displayLabel}
      </div>
      {isOpen && (
        <div className="rich-select-menu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`rich-select-option ${option.value === value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setIsOpen(false);
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
