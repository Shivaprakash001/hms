import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Building2 } from 'lucide-react';
import { FinancialControlCenter } from './FinancialControlCenter';

export function BillingDashboard() {
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  const { data: hostelsData, isLoading } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => import('@features/owners/api').then((m) => m.ownerService.getHostels()),
    staleTime: 10 * 60 * 1000,
  });

  const hostels: any[] = Array.isArray(hostelsData?.data)
    ? hostelsData.data
    : Array.isArray(hostelsData)
      ? hostelsData
      : [];

  const activeHostelId = selectedHostelId || hostels[0]?.id || '';
  const activeHostel = hostels.find((h) => h.id === activeHostelId);

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Financial Control Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligence-driven financial operations for your hostels
          </p>
        </div>

        {hostels.length > 1 && (
          <div className="relative">
            <select
              value={activeHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              className="h-9 pl-9 pr-8 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              {hostels.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name ?? h.hostel_name ?? h.id}
                </option>
              ))}
            </select>
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {hostels.length === 1 && activeHostel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            {activeHostel.name ?? activeHostel.hostel_name}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !activeHostelId && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No hostels found</p>
          <p className="text-xs text-muted-foreground mt-1">Create a hostel to start tracking financials</p>
        </div>
      )}

      {!isLoading && activeHostelId && (
        <FinancialControlCenter
          hostelId={activeHostelId}
          onRecordPayment={() => setShowRecordPayment(true)}
        />
      )}

      {showRecordPayment && activeHostelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
            <p className="text-sm text-muted-foreground">
              Use the Record Payment button in the hostel detail view for full tenant context.
            </p>
            <button
              type="button"
              onClick={() => setShowRecordPayment(false)}
              className="mt-4 w-full py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
