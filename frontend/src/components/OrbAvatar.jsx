import React from 'react';

export function OrbAvatar({ isPulsing = false, size = 'sm' }) {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
  };

  return (
    <div
      className={`rounded-full flex-shrink-0 relative orb-avatar ${sizeClasses[size] || sizeClasses.sm} ${
        isPulsing ? 'orb-avatar-pulsing' : ''
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-white/20 filter blur-[1px] pointer-events-none" />
    </div>
  );
}
