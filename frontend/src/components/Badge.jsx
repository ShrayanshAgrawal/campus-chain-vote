import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-brand-50 text-brand-700 border-brand-200 font-semibold',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
    open: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
    closed: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    upcoming: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
  };

  const selectedVariant = variants[variant.toLowerCase()] || variants.default;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${selectedVariant} ${className}`}
    >
      {children}
    </span>
  );
}
