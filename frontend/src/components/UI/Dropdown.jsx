import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export const Dropdown = React.memo(({ 
  label,
  items = [],
  onSelect,
  className = '',
  itemClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback((item) => {
    onSelect?.(item);
    handleClose();
  }, [onSelect, handleClose]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClose]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 border border-slate-300 text-slate-900 text-sm font-medium hover:bg-slate-200 transition-all"
      >
        {label}
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${itemClassName}`}
            >
              {item.label || item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

Dropdown.displayName = 'Dropdown';

