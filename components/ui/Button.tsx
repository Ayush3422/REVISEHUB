'use client';

import React from 'react';
import { Spinner } from './Loader';

/**
 * The one place button styling is defined. Before this, each panel hand-rolled
 * its own gradient and glow, which drifted apart as they were edited.
 */

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-neon-violet to-neon-pink text-[#12071f] font-semibold ' +
    'shadow-[0_0_20px_rgba(167,139,250,0.35)] ' +
    'hover:shadow-[0_0_30px_rgba(167,139,250,0.55)] hover:brightness-110',
  outline:
    'border border-white/12 bg-white/[0.04] text-text-secondary ' +
    'hover:border-neon-violet/60 hover:text-neon-violet hover:bg-neon-violet/[0.07]',
  ghost: 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
  danger:
    'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:border-danger/60',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-3 text-sm gap-2.5 rounded-xl',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      // `disabled` is driven by `loading` too, so a slow request cannot be
      // double-submitted by an impatient second click.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`press inline-flex cursor-pointer items-center justify-center whitespace-nowrap font-medium
        disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
      {children}
    </button>
  );
}

/** Segmented control used for filters; keeps the pressed state accessible. */
export function SegmentedButton({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      aria-pressed={active}
      className={`press cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-neon-violet/15 text-neon-violet shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]'
          : 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
