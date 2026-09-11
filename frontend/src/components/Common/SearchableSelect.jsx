import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { matchesSearch } from '../../utils/vietnamProvinces';

export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = '-- Chọn --',
  disabled = false,
  loading = false,
  allowCustom = true,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = (options || []).filter(opt => {
    const label = typeof opt === 'string' ? opt : (opt.name || opt.label || '');
    return matchesSearch(label, searchTerm);
  });

  const hasExactMatch = searchTerm && filteredOptions.some(opt => {
    const label = typeof opt === 'string' ? opt : (opt.name || opt.label || '');
    return label.toLowerCase().trim() === searchTerm.toLowerCase().trim();
  });

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange('');
    setSearchTerm('');
  };

  const displayPlaceholder = loading
    ? '-- Đang tải dữ liệu... --'
    : placeholder;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger Select Box */}
      <div
        onClick={() => {
          if (!disabled && !loading) setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          padding: '0.65rem 2.2rem 0.65rem 0.85rem',
          borderRadius: '8px',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          fontSize: '0.88rem',
          color: value ? '#0f172a' : '#94a3b8',
          backgroundColor: disabled || loading ? '#f8fafc' : '#ffffff',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          boxSizing: 'border-box',
          position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: value ? 500 : 400 }}>
          {value || displayPlaceholder}
        </span>

        <div style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {value && !disabled && !loading && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              title="Xóa lựa chọn"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              transform: `rotate(${isOpen ? 180 : 0}deg)`,
              transition: 'transform 0.2s ease',
              color: '#64748b',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {/* Dropdown Options Popup */}
      {isOpen && !disabled && !loading && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999999,
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)',
            padding: '0.45rem',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Gõ để tìm kiếm..."
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem 0.5rem 2.1rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    const first = filteredOptions[0];
                    handleSelect(typeof first === 'string' ? first : first.name);
                  } else if (allowCustom && searchTerm.trim()) {
                    handleSelect(searchTerm.trim());
                  }
                }
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', maxHeight: '190px', display: 'flex', flexDirection: 'column' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const optName = typeof opt === 'string' ? opt : opt.name;
                const optKey = typeof opt === 'string' ? `${opt}-${idx}` : (opt.code || opt.id || idx);
                const isSelected = value === optName;
                return (
                  <div
                    key={optKey}
                    onClick={() => handleSelect(optName)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.83rem',
                      color: isSelected ? '#2563eb' : '#0f172a',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      fontWeight: isSelected ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{optName}</span>
                    {isSelected && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>✓</span>}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                Không tìm thấy kết quả phù hợp.
              </div>
            )}

            {/* Allow custom typed term if not exactly in list */}
            {allowCustom && searchTerm.trim() && !hasExactMatch && (
              <div
                onClick={() => handleSelect(searchTerm.trim())}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderTop: '1px dashed #e2e8f0',
                  marginTop: '0.25rem',
                  fontSize: '0.82rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px'
                }}
              >
                + Sử dụng: "{searchTerm.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
