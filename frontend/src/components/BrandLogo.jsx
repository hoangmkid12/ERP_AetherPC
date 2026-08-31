import React from 'react';

export default function BrandLogo({ name, height = 24 }) {
  const brandName = (name || '').toUpperCase().trim();

  switch (brandName) {
    case 'INTEL':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <text x="32" y="21" fontFamily="var(--font-title)" fontWeight="800" fontSize="19" fill="currentColor">intel</text>
          <ellipse cx="60" cy="16" rx="55" ry="14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="160" strokeDashoffset="20" transform="rotate(-5 60 16)" />
        </svg>
      );

    case 'AMD':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g transform="translate(5, 4)">
            <polygon points="0,4 12,4 20,12 20,24 16,24 16,14 0,14" fill="#ED1C24" />
            <polygon points="8,18 16,18 16,26 12,26 12,21 8,21" fill="#ED1C24" />
            <text x="32" y="19" fontFamily="var(--font-title)" fontWeight="900" fontSize="20" fill="currentColor">AMD</text>
          </g>
        </svg>
      );

    case 'ASUS':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <text x="15" y="23" fontFamily="var(--font-title)" fontWeight="900" fontSize="23" fontStyle="italic" letterSpacing="2" fill="currentColor">ASUS</text>
          {/* Horizontal cut overlays */}
          <line x1="17" y1="16" x2="41" y2="16" stroke="var(--bg-secondary)" strokeWidth="2.5" />
          <line x1="45" y1="16" x2="58" y2="16" stroke="var(--bg-secondary)" strokeWidth="2.5" />
          <line x1="62" y1="16" x2="85" y2="16" stroke="var(--bg-secondary)" strokeWidth="2.5" />
          <line x1="89" y1="16" x2="103" y2="16" stroke="var(--bg-secondary)" strokeWidth="2.5" />
        </svg>
      );

    case 'MSI':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g transform="translate(10, 0)">
            <path d="M10,2 L24,2 L26,14 C26,20 20,25 17,27 C14,25 8,20 8,14 Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12,6 L22,6 L22,12 C22,18 17,21 17,21 C17,21 12,18 12,12 Z" fill="currentColor" opacity="0.3" />
            <text x="36" y="22" fontFamily="var(--font-title)" fontWeight="800" fontSize="21" fontStyle="italic" letterSpacing="1" fill="currentColor">msi</text>
          </g>
        </svg>
      );

    case 'GIGABYTE':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <text x="8" y="22" fontFamily="var(--font-title)" fontWeight="900" fontSize="18" letterSpacing="-0.5" fill="currentColor">GIGABYTE</text>
        </svg>
      );

    case 'CORSAIR':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g transform="translate(8, 2)" fill="currentColor">
            <path d="M0,28 C10,24 16,14 18,2 C12,12 6,22 0,28 Z" />
            <path d="M5,28 C13,24 19,16 21,6 C16,15 11,23 5,28 Z" opacity="0.8" />
            <path d="M10,28 C16,24 22,18 24,10 C20,18 16,24 10,28 Z" opacity="0.6" />
          </g>
          <text x="44" y="21" fontFamily="var(--font-title)" fontWeight="800" fontSize="16" letterSpacing="1" fill="currentColor">CORSAIR</text>
        </svg>
      );

    case 'KINGSTON':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g transform="translate(5, 4)">
            <path d="M2,24 L14,24 L14,14 L10,18 L8,10 L6,18 L2,14 Z" fill="#ef4444" />
          </g>
          <text x="26" y="22" fontFamily="var(--font-title)" fontWeight="800" fontSize="18" fill="currentColor">Kingston</text>
        </svg>
      );

    case 'SAMSUNG':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <ellipse cx="60" cy="16" rx="58" ry="13" fill="#0A5CA6" transform="rotate(-6 60 16)" />
          <text x="18" y="21" fontFamily="var(--font-title)" fontWeight="900" fontSize="13" fill="#fff" letterSpacing="1" transform="rotate(-6 60 16)">SAMSUNG</text>
        </svg>
      );

    case 'NZXT':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <text x="32" y="23" fontFamily="var(--font-title)" fontWeight="800" fontSize="24" letterSpacing="-1" fill="currentColor">nzxt</text>
        </svg>
      );

    case 'DEEPCOOL':
      return (
        <svg viewBox="0 0 120 32" height={height} fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g transform="translate(8, 6)" fill="#00A1E4">
            <rect x="0" y="0" width="8" height="8" rx="1" />
            <rect x="10" y="0" width="8" height="8" rx="1" />
            <rect x="0" y="10" width="8" height="8" rx="1" />
            <rect x="10" y="10" width="8" height="8" rx="1" />
          </g>
          <text x="36" y="21" fontFamily="var(--font-title)" fontWeight="700" fontSize="15" fill="currentColor">DEEPCOOL</text>
        </svg>
      );

    default:
      return <span style={{ fontWeight: 'bold' }}>{name}</span>;
  }
}
