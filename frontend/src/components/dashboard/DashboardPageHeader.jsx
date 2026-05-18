import React from 'react';

export function DashboardPageHeader({ eyebrow, title, actions }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs text-muted-foreground font-medium mb-1">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
