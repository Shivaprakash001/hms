import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function TenantPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'me', 'payments'],
    queryFn: () => tenantService.getMyPaymentHistory(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const obligations = (data?.obligations ?? []) as Record<string, unknown>[];
  const outstanding = Number(data?.outstanding_balance ?? data?.pending_amount ?? 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Payments</h1>
      <div className="p-4 rounded-xl border border-border bg-card">
        <p className="text-xs text-muted-foreground">Outstanding balance</p>
        <p className="text-2xl font-bold text-foreground">{fmt(outstanding)}</p>
      </div>
      <RentObligationList obligations={obligations as never[]} />
    </div>
  );
}
