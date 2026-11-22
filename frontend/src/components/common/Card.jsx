import React from 'react';

export const Card = ({ children, className = '', hover = false, ...props }) => (
  <div
    className={`min-w-0 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] transition-colors ${hover ? 'hover:border-[color:var(--focus)]' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', title, subtitle, action }) => (
  <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--line)] px-4 py-3 ${className}`}>
    <div className="min-w-0">
      {title && <h2 className="font-display text-2xl font-bold leading-none">{title}</h2>}
      {subtitle && <p className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</p>}
      {children}
    </div>
    {action && <div className="min-w-0">{action}</div>}
  </div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);
