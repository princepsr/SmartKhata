import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

export interface SearchableOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync searchTerm with value when not focused
  useEffect(() => {
    if (!isFocused) {
      const selectedOption = options.find((opt) => opt.value === value);
      setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [value, options, isFocused]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    // If input is cleared, notifying parent depending on requirements
    // For now, we just let the user filter.
  };

  const handleSelect = (option: SearchableOption) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    setIsFocused(false);
  };

  return (
    <div className={`searchable-select-wrapper ${className}`} ref={wrapperRef}>
      <div className="search-box-container">
        <input
          ref={inputRef}
          type="text"
          className={`search-box-input ${isOpen ? 'is-open' : ''}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <div className="searchable-select-menu">
          <div className="searchable-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`searchable-select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="no-options">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
