import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { paymentService } from '@features/payments/api';
import { queryKeys } from '@lib/queryKeys';

function fmt(n: unknown): string {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export function BillingView() {
  const { data: hostelsData } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as Record<string, unknown>)?.hostels)
    ? ((hostelsData as Record<string, unknown>).hostels as Record<string, unknown>[])
    : [];

  const firstHostelId = hostels.length > 0 ? String(hostels[0].id ?? '') : null;

  const { data: paymentsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.payments.ledger(firstHostelId ?? 'none', { limit: 20 }),
    queryFn: () => paymentService.getAll(firstHostelId!, { limit: 20 }),
    enabled: !!firstHostelId,
    staleTime: 2 * 60 * 1000,
  });

  const payments: Record<string, unknown>[] = Array.isArray(paymentsData)
    ? paymentsData
    : Array.isArray((paymentsData as Record<string, unknown>)?.payments)
    ? ((paymentsData as Record<string, unknown>).payments as Record<string, unknown>[])
    : [];

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid ?? p.amount ?? 0), 0);

  const currentMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Billing &amp; Revenue</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your financial performance</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Collected</span>
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{fmt(totalCollected)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{payments.length} payments</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Period</span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-sm font-semibold text-foreground">{currentMonth}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{hostels.length} properties</div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load payments</p>
          <button onClick={() => refetch()} className="text-xs text-accent font-medium active:scale-95 transition-transform">
            Retry
          </button>
        </div>
      )}

      {!isLoading && payments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Recent Payments</h3>
          <div className="space-y-3">
            {payments.map((p, i) => {
              const status = String(p.status ?? 'paid').toLowerCase();
              const payDate = p.payment_date ?? p.created_at ?? p.paid_at;
              return (
                <div key={String(p.id ?? i)} className="bg-card border border-border rounded-xl p-4 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">{String(p.tenant_name ?? p.name ?? 'Tenant')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{String(p.hostel_name ?? p.hostel ?? '')}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                      status === 'paid' || status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981]' :
                      status === 'pending' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                      'bg-[#6B7280]/10 text-[#6B7280]'
                    }`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      {payDate ? new Date(String(payDate)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{fmt(p.amount_paid ?? p.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && payments.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">No payments found</div>
      )}
    </div>
  );
}
