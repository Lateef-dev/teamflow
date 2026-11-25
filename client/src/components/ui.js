'use client';

import { forwardRef } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(fieldClass, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(fieldClass, 'resize-y', className)} {...props} />;
});

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(fieldClass, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, error, children, hint }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={cx('animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-3 py-24 text-slate-500" role="status">
      <Spinner /> <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ className, children }) {
  return <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium', className)}>{children}</span>;
}
