import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n || 0)}`;

const STATUSES = ['All', 'PAID', 'PARTIAL', 'PENDING', 'OVERDUE', 'WAIVED'];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    PAID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    PARTIAL: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    OVERDUE: 'bg-red-500/15 text-red-700 dark:text-red-300',
    WAIVED: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded capitalize', cfg[status] ?? 'bg-muted text-muted-foreground')}>
      {status.toLowerCase()}
    </span>
  );
}

function methodShort(method: string | undefined) {
  if (!method) return '—';
  const m = method.toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'cash') return 'Cash';
  if (m === 'bank_transfer' || m === 'neft' || m === 'imps') return 'Bank';
  if (m === 'card') return 'Card';
  if (m === 'cheque') return 'Cheque';
  return method;
}

interface Props {
  hostelId: string;
  payments: any[];
  paymentsData: any;
  onRowClick: (id: string) => void;
  refetch?: () => void;
}

export function PaymentLedger({ payments, paymentsData, onRowClick }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const stats = paymentsData?.stats ?? {};

  const rows = useMemo(() => {
    let list = payments;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.tenantName ?? p.tenant_name ?? '').toLowerCase().includes(q) ||
          (p.roomNo ?? p.room_no ?? '').toLowerCase().includes(q) ||
          (p.rentMonth ?? p.rent_month ?? '').toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'All') {
      list = list.filter((p) => (p.status ?? '').toUpperCase() === statusFilter);
    }
    return list;
  }, [payments, search, statusFilter]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" id="ledger">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Payment Ledger</h3>
            {stats.total_collected !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Collected {fmt(stats.total_collected)} · {fmt(stats.pending_dues ?? 0)} pending
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tenant, room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-44"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'h-8 px-3 flex items-center gap-1.5 text-xs rounded-lg border transition-colors',
                showFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  statusFilter === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          {search || statusFilter !== 'All' ? 'No results match your filter' : 'No payment records found'}
        </div>
      ) : (
        <>
          {/* Mobile View: cards list */}
          <div className="block md:hidden divide-y divide-border max-h-[560px] overflow-y-auto">
            {rows.map((p: any, i: number) => {
              const id = p.obligation_id ?? p.id;
              const name = p.tenantName ?? p.tenant_name ?? 'Unknown';
              const room = p.roomNo ?? p.room_no ?? '—';
              const month = p.rentMonth ?? p.rent_month ?? '—';
              const status = (p.status ?? 'PENDING').toUpperCase();
              const total = Number(p.rentAmount ?? p.total_amount ?? p.amount ?? 0);
              const outstanding = Number(p.outstanding ?? p.remaining ?? 0);
              const method = p.paymentMethod ?? p.payment_method;
              const daysOverdue = Number(p.daysOverdue ?? p.days_overdue ?? 0);

              return (
                <button
                  key={id ?? i}
                  type="button"
                  onClick={() => id && onRowClick(id)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors flex justify-between items-start gap-3",
                    daysOverdue > 0 && status !== 'PAID' ? 'bg-red-500/5' : ''
                  )}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground">Room {room} · {month}</div>
                    {method && (
                      <div className="text-xs text-muted-foreground">Paid via {methodShort(method)}</div>
                    )}
                  </div>
                  <div className="text-right space-y-1 shrink-0">
                    <div className="font-bold text-sm text-foreground">{fmt(total)}</div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={status} />
                      {outstanding > 0 && status !== 'PAID' && (
                        <span className="text-[10px] font-semibold text-red-500">{fmt(outstanding)} due</span>
                      )}
                      {daysOverdue > 0 && status !== 'PAID' && (
                        <span className="text-[10px] text-red-500">{daysOverdue}d late</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop View: virtualized table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[560px] text-sm">
              <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.9fr] border-b border-border bg-muted/30">
                <div className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Tenant</div>
                <div className="text-left text-xs font-medium text-muted-foreground px-2 py-2.5">Room</div>
                <div className="text-left text-xs font-medium text-muted-foreground px-2 py-2.5">Month</div>
                <div className="text-left text-xs font-medium text-muted-foreground px-2 py-2.5">Status</div>
                <div className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Amount</div>
              </div>
              <div ref={scrollRef} className="max-h-[560px] overflow-auto">
                <div
                  className="relative w-full"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const p: any = rows[virtualRow.index];
                    const i = virtualRow.index;
                    const id = p.obligation_id ?? p.id;
                    const name = p.tenantName ?? p.tenant_name ?? 'Unknown';
                    const room = p.roomNo ?? p.room_no ?? '—';
                    const month = p.rentMonth ?? p.rent_month ?? '—';
                    const status = (p.status ?? 'PENDING').toUpperCase();
                    const total = Number(p.rentAmount ?? p.total_amount ?? p.amount ?? 0);
                    const outstanding = Number(p.outstanding ?? p.remaining ?? 0);
                    const method = p.paymentMethod ?? p.payment_method;
                    const daysOverdue = Number(p.daysOverdue ?? p.days_overdue ?? 0);

                    return (
                      <button
                        key={id ?? i}
                        type="button"
                        onClick={() => id && onRowClick(id)}
                        className={cn(
                          'absolute left-0 grid w-full grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.9fr] border-b border-border text-left hover:bg-muted/40 transition-colors',
                          daysOverdue > 0 && status !== 'PAID' ? 'bg-red-500/5' : '',
                        )}
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <div className="px-4 py-3">
                          <div className="font-medium text-foreground truncate max-w-[120px]">{name}</div>
                          {method && (
                            <div className="text-xs text-muted-foreground">{methodShort(method)}</div>
                          )}
                        </div>
                        <div className="px-2 py-3 text-xs text-muted-foreground">{room}</div>
                        <div className="px-2 py-3 text-xs text-muted-foreground">{month}</div>
                        <div className="px-2 py-3">
                          <StatusBadge status={status} />
                          {daysOverdue > 0 && status !== 'PAID' && (
                            <div className="text-xs text-red-500 mt-0.5">{daysOverdue}d late</div>
                          )}
                        </div>
                        <div className="px-4 py-3 text-right">
                          <div className="font-semibold text-foreground">{fmt(total)}</div>
                          {outstanding > 0 && status !== 'PAID' && (
                            <div className="text-xs text-red-500">{fmt(outstanding)} due</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
