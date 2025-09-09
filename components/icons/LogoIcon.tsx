import React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <radialGradient id="logo-grad-handle" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </radialGradient>
      <linearGradient id="logo-grad-ring" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="50%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
      <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#logo-glow)">
      <path d="M145 145 L210 210" stroke="url(#logo-grad-handle)" strokeWidth="28" strokeLinecap="round" />
      <circle cx="95" cy="95" r="80" stroke="url(#logo-grad-ring)" strokeWidth="18" fill="none" />
      <g>
        <circle cx="95" cy="95" r="45" fill="#38BDF8" stroke="#0EA5E9" strokeWidth="4" />
        <circle cx="95" cy="95" r="36" fill="none" stroke="#0EA5E9" strokeWidth="4" opacity="0.5"/>
        <circle cx="82" cy="90" r="7" fill="#0F172A" />
        <circle cx="108" cy="90" r="7" fill="#0F172A" />
        <path d="M82 110 Q 95 120 108 110" stroke="#EC4899" strokeWidth="4" fill="none" strokeLinecap="round" />
        <line x1="85" y1="58" x2="75" y2="38" stroke="#F43F5E" strokeWidth="5" strokeLinecap="round" />
        <circle cx="73" cy="35" r="5" fill="#FBBF24" />
      </g>
    </g>
</svg>
);