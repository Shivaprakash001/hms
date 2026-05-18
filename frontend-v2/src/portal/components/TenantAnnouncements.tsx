import { Bell } from 'lucide-react';

interface Notification {
  id?: string;
  title?: string;
  message?: string;
  body?: string;
  created_at?: string;
  read?: boolean;
  type?: string;
}

export function TenantAnnouncements({ items }: { items?: Notification[] | null }) {
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const recent = list.slice(0, 5);

  if (recent.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-4 text-center">
        <Bell className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">No announcements right now</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3">Announcements</h2>
      <ul className="space-y-2">
        {recent.map((n, i) => (
          <li
            key={n.id ?? i}
            className={`p-3 rounded-xl border border-border bg-card text-sm ${
              n.read === false ? 'border-l-4 border-l-accent' : ''
            }`}
          >
            <p className="font-medium text-foreground">{n.title ?? n.type ?? 'Notice'}</p>
            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
              {n.message ?? n.body ?? ''}
            </p>
            {n.created_at && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
