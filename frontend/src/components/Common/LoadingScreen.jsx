import React from 'react';
import { ShieldAlert, Cpu } from 'lucide-react';

export default function LoadingScreen({
  text = 'Đang nạp phân hệ...',
  subtext = '',
  minHeight = '100dvh',
  fullScreen = false
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100dvh' : minHeight,
        width: '100%',
        backgroundColor: 'var(--bg-app, #f8fafc)',
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : 'auto',
        zIndex: fullScreen ? 999999 : 1,
        padding: '1.5rem 1rem',
        boxSizing: 'border-box',
        animation: 'fadeInLoading 0.3s ease-out'
      }}
    >
      {/* Glow + Rotating Ring + Logo Avatar */}
      <div style={{ position: 'relative', width: '84px', height: '84px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Pulsing Aura */}
        <div
          style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%)',
            animation: 'pulseGlow 2.4s ease-in-out infinite'
          }}
        />

        {/* Outer Rotating Glowing Ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor: '#2563eb',
            borderRightColor: '#60a5fa',
            animation: 'spin 1.1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite'
          }}
        />

        {/* Inner Secondary Rotating Ring (Reverse) */}
        <div
          style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            border: '2px dashed rgba(37,99,235,0.25)',
            borderBottomColor: '#2563eb',
            animation: 'spin 2.2s linear infinite reverse'
          }}
        />

        {/* Center Logo Icon */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 6px 18px rgba(37, 99, 235, 0.4)',
            zIndex: 2
          }}
        >
          <ShieldAlert size={26} strokeWidth={2.2} />
        </div>
      </div>

      {/* Brand Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', fontFamily: 'var(--font-title, inherit)' }}>
          AETHER PC
        </span>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
          ERP
        </span>
      </div>

      {/* Status Text */}
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', margin: subtext ? '0 0 0.35rem 0' : '0 0 1.25rem 0', textAlign: 'center', maxWidth: '90vw' }}>
        {text}
      </h3>

      {/* Subtext (only if provided) */}
      {subtext && (
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem 0', textAlign: 'center', maxWidth: '320px', lineHeight: 1.45 }}>
          {subtext}
        </p>
      )}

      {/* Modern High-Tech Shimmer Progress Bar */}
      <div
        style={{
          width: 'min(200px, 65vw)',
          height: '4px',
          borderRadius: '999px',
          backgroundColor: '#e2e8f0',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '45%',
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 50%, #2563eb 100%)',
            boxShadow: '0 0 8px rgba(37,99,235,0.5)',
            animation: 'shimmerLoading 1.4s ease-in-out infinite'
          }}
        />
      </div>
    </div>
  );
}
