import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Eye, Bell, LogOut, Send } from 'lucide-react';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { getInitials, type NormalizedTenant } from '@features/tenants/utils/normalize';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface Props {
  tenants: NormalizedTenant[];
  hostelId: string;
  onReminder?: (t: NormalizedTenant) => void;
  onMoveOut?: (t: NormalizedTenant) => void;
  onResend?: (t: NormalizedTenant) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (tenantId: string) => void;
}

export function TenantTable({ tenants, hostelId, onReminder, onMoveOut, onResend, selectedIds, onToggleSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: tenants.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  if (tenants.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">No tenants match your filters</p>
    );
  }

  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
      <div className="min-w-[980px] text-sm">
        <div className="grid grid-cols-[48px_1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_1fr_1fr_80px] bg-secondary/50 text-left text-xs text-muted-foreground">
          <div className="px-4 py-3 font-medium">{onToggleSelect ? 'Pick' : ''}</div>
          <div className="px-4 py-3 font-medium">Tenant</div>
          <div className="px-4 py-3 font-medium">Room</div>
          <div className="px-4 py-3 font-medium">Rent</div>
          <div className="px-4 py-3 font-medium">Due</div>
          <div className="px-4 py-3 font-medium">Status</div>
          <div className="px-4 py-3 font-medium">Joined</div>
          <div className="px-4 py-3 font-medium text-right">Outstanding</div>
          <div className="px-4 py-3" />
        </div>
        <div ref={scrollRef} className="max-h-[620px] overflow-auto">
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = tenants[virtualRow.index];
            const overdue =
              t.outstandingAmount > 0 &&
              ['PENDING', 'PARTIAL'].includes(String(t.paymentStatus).toUpperCase());
            return (
              <div
                key={t.id}
                className="absolute left-0 grid w-full grid-cols-[48px_1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_1fr_1fr_80px] border-t border-border hover:bg-secondary/30"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="px-4 py-3">
                  {onToggleSelect && (
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(t.id) ?? false}
                      onChange={() => onToggleSelect(t.id)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      aria-label={`Select ${t.name}`}
                    />
                  )}
                </div>
                <div className="px-4 py-3">
                  <Link
                    to={`/hostels/${hostelId}/tenants/${t.id}`}
                    className="flex items-center gap-2 min-w-0 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/15 overflow-hidden flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                      {t.photoUrl ? (
                        <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(t.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate group-hover:text-accent">
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.phone}</p>
                    </div>
                  </Link>
                </div>
                <div className="px-4 py-3 text-foreground">{t.room}</div>
                <div className="px-4 py-3">{fmt(t.rent)}/mo</div>
                <div className="px-4 py-3">
                  <span
                    className={
                      overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    }
                  >
                    {String(t.paymentStatus)}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <TenantStatusBadge status={t.status} />
                </div>
                <div className="px-4 py-3 text-muted-foreground">
                  {t.joinDate ? new Date(t.joinDate).toLocaleDateString('en-IN') : '—'}
                </div>
                <div className="px-4 py-3 text-right font-medium">
                  {t.outstandingAmount > 0 ? (
                    <span className="text-destructive">{fmt(t.outstandingAmount)}</span>
                  ) : (
                    <span className="text-emerald-600">Clear</span>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/hostels/${hostelId}/tenants/${t.id}`}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {onReminder && t.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => onReminder(t)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                        title="Send reminder"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    )}
                    {onMoveOut && t.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => onMoveOut(t)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                        title="Start move-out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                    {onResend && t.status === 'INVITED' && (
                      <button
                        type="button"
                        onClick={() => onResend(t)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                        title="Resend invitation"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
