import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Clock, Phone, Bell, Loader2, CheckCircle } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { paymentService } from '@features/payments/api';
import { queryKeys } from '@lib/queryKeys';

function fmt(n: unknown): string {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export function AlertsView() {
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

  const { data: duesData, isLoading } = useQuery({
    queryKey: queryKeys.payments.dues(firstHostelId ?? 'none'),
    queryFn: () => paymentService.getAllDues(firstHostelId!),
    enabled: !!firstHostelId,
    staleTime: 2 * 60 * 1000,
  });

  const dues: Record<string, unknown>[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown>)?.dues)
    ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
    : [];

  const now = Date.now();
  const overdueAlerts = dues.filter((d) => {
    const dueDate = d.due_date ? new Date(String(d.due_date)).getTime() : 0;
    return dueDate < now;
  });
  const pendingAlerts = dues.filter((d) => {
    const dueDate = d.due_date ? new Date(String(d.due_date)).getTime() : 0;
    return dueDate >= now;
  });

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Stay on top of important updates</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-[#EF4444]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            <span className="text-xs text-muted-foreground">Overdue</span>
          </div>
          <div className="text-xl font-semibold text-foreground">{overdueAlerts.length}</div>
        </div>
        <div className="bg-card border border-[#F59E0B]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <div className="text-xl font-semibold text-foreground">{pendingAlerts.length}</div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && dues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <CheckCircle className="w-8 h-8 text-[#10B981]" />
          <p className="text-sm text-muted-foreground">No pending dues</p>
        </div>
      )}

      {!isLoading && dues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Pending Dues ({dues.length})</h3>
          <div className="space-y-3">
            {dues.map((due, i) => {
              const dueDate = due.due_date ? new Date(String(due.due_date)) : null;
              const isOverdue = dueDate ? dueDate.getTime() < now : false;
              const amount = Number(due.amount ?? due.outstanding ?? 0);
              return (
                <div
                  key={String(due.id ?? i)}
                  className={`bg-card border rounded-xl p-4 space-y-3 ${
                    isOverdue ? 'border-[#EF4444]/20' : 'border-[#F59E0B]/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    }`}>
                      {isOverdue ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground">{String(due.tenant_name ?? due.name ?? 'Tenant')}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {fmt(amount)} {isOverdue ? 'overdue' : 'pending'}
                      </p>
                      {dueDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          <span>Due: {dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4" />
                      Call
                    </button>
                    <button className="bg-card border border-border text-foreground py-2.5 rounded-lg text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2">
                      <Bell className="w-4 h-4" />
                      Notify
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

