import type { ReactNode } from 'react';

export function ProfileSection({
  id,
  title,
  description,
  children,
  readOnly = false,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border p-4 ${readOnly ? 'border-border bg-muted/30' : 'border-border bg-card'}`}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        {readOnly && (
          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Read only
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b border-border/60 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right break-all">{value ?? '—'}</span>
    </div>
  );
}

