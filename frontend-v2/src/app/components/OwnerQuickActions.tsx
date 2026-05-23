import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Plus, Search, UserPlus, X } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';
import { AddTenantModal } from './modals/AddTenantModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';

type Action = 'menu' | 'payment' | 'tenant' | null;

function unwrapHostels(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const obj = raw as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown> | undefined)?.hostels)) {
    return (obj?.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  }
  return [];
}

export function OwnerQuickActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState<Action>(null);

  const { data } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60_000,
  });

  const hidden =
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/tenant');

  if (hidden) return null;

  const hostels = unwrapHostels(data);
  const hostelId = String(hostels[0]?.id ?? '');
  const canUseHostelActions = Boolean(hostelId);

  return (
    <>
      {active === 'menu' && (
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setActive(null)}>
          <div
            className="absolute bottom-24 right-4 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-xl md:bottom-6 md:right-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-sm font-semibold text-foreground">Quick actions</p>
              <button type="button" onClick={() => setActive(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canUseHostelActions}
                onClick={() => setActive('payment')}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
              >
                <IndianRupee className="h-4 w-4 text-accent" />
                <span>
                  <span className="block">Quick collect</span>
                  <span className="block text-xs font-normal text-muted-foreground">Tenant search, amount, cash or UPI</span>
                </span>
              </button>
              <button
                type="button"
                disabled={!canUseHostelActions}
                onClick={() => setActive('tenant')}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 text-accent" />
                Add tenant
              </button>
              <button
                type="button"
                onClick={() => {
                  setActive(null);
                  navigate('/tenants');
                }}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-medium"
              >
                <Search className="h-4 w-4 text-accent" />
                Find tenant
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setActive(active === 'menu' ? null : 'menu')}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition-transform active:scale-95 md:bottom-6 md:right-6"
        aria-label="Open quick actions"
      >
        <Plus className={`h-6 w-6 transition-transform ${active === 'menu' ? 'rotate-45' : ''}`} />
      </button>

      {active === 'payment' && hostelId && (
        <RecordPaymentModal hostelId={hostelId} onClose={() => setActive(null)} />
      )}
      {active === 'tenant' && hostelId && (
        <AddTenantModal hostelId={hostelId} onClose={() => setActive(null)} />
      )}
    </>
  );
}
