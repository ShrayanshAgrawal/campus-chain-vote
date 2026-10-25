import React from 'react';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-subtle p-6 ${
        hover ? 'hover:shadow-card hover:border-slate-300 transition duration-150' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-sm text-slate-500 mt-1 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={`${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`mt-6 pt-4 border-t border-slate-100 flex items-center justify-between ${className}`}>{children}</div>;
}
