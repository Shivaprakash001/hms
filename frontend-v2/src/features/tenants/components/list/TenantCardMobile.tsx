import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, Bell, Phone, Send } from 'lucide-react';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { getInitials, type NormalizedTenant } from '@features/tenants/utils/normalize';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface Props {
  tenants: NormalizedTenant[];
  hostelId: string;
  onSelect?: (t: NormalizedTenant) => void;
  onReminder?: (t: NormalizedTenant) => void;
  onCall?: (phone: string) => void;
  onResend?: (t: NormalizedTenant) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (tenantId: string) => void;
}

export function TenantCardMobile({ tenants, hostelId, onSelect, onReminder, onCall, onResend, selectedIds, onToggleSelect }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const updateOffset = () => {
      const node = listRef.current;
      if (!node) return;
      setScrollMargin(node.getBoundingClientRect().top + window.scrollY);
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [tenants.length]);

  const virtualizer = useWindowVirtualizer({
    count: tenants.length,
    estimateSize: () => 156,
    overscan: 5,
    scrollMargin,
  });

  if (tenants.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12 md:hidden">No tenants found</p>
    );
  }

  return (
    <div
      ref={listRef}
      className="md:hidden relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const tenant = tenants[virtualRow.index];
        return (
          <div
            key={tenant.id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 right-0 pb-3"
            style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
          >
            <TenantMobileRow
              tenant={tenant}
              hostelId={hostelId}
              selected={selectedIds?.has(tenant.id) ?? false}
              onSelect={onSelect}
              onReminder={onReminder}
              onCall={onCall}
              onResend={onResend}
              onToggleSelect={onToggleSelect}
            />
          </div>
        );
      })}
    </div>
  );
}

const TenantMobileRow = memo(function TenantMobileRow({
  tenant: t,
  hostelId,
  selected,
  onSelect,
  onReminder,
  onCall,
  onResend,
  onToggleSelect,
}: {
  tenant: NormalizedTenant;
  hostelId: string;
  selected: boolean;
  onSelect?: (t: NormalizedTenant) => void;
  onReminder?: (t: NormalizedTenant) => void;
  onCall?: (phone: string) => void;
  onResend?: (t: NormalizedTenant) => void;
  onToggleSelect?: (tenantId: string) => void;
}) {
  const overdue = t.outstandingAmount > 0;
  const inner = (
    <>
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => {
              event.stopPropagation();
              onToggleSelect(t.id);
            }}
            onClick={(event) => event.stopPropagation()}
            className="mt-3 h-4 w-4 rounded border-border text-accent focus:ring-accent shrink-0"
            aria-label={`Select ${t.name}`}
          />
        )}
        <div className="w-11 h-11 rounded-full bg-accent/15 overflow-hidden flex items-center justify-center text-sm font-semibold text-accent shrink-0">
          {t.photoUrl ? (
            <img src={t.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            getInitials(t.name)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground truncate">{t.name}</p>
            <TenantStatusBadge status={t.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Room {t.room} · {fmt(t.rent)}/mo
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-sm font-medium ${overdue ? 'text-destructive' : 'text-emerald-600'}`}>
              {overdue ? `Due ${fmt(t.outstandingAmount)}` : 'Paid up'}
            </span>
            {!onSelect && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>
      {(onCall || onReminder) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
          {onCall && (
            <button
              type="button"
              onClick={() => onCall(t.phone)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-sm font-medium touch-manipulation"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
          )}
          {onReminder && t.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => onReminder(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-sm font-medium touch-manipulation"
            >
              <Bell className="w-4 h-4" />
              Remind
            </button>
          )}
          {onResend && t.status === 'INVITED' && (
            <button
              type="button"
              onClick={() => onResend(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium touch-manipulation"
            >
              <Send className="w-4 h-4" />
              Resend Invite
            </button>
          )}
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(t)}
        className="w-full text-left bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform touch-manipulation"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={`/hostels/${hostelId}/tenants/${t.id}`}
      className="block bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform touch-manipulation"
    >
      {inner}
    </Link>
  );
});
