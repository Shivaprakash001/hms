import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, CreditCard, Phone, ChevronRight, Send } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { fmt, fmtExact } from '../shared/format';
import { TabError, TabSkeleton } from '../shared/TabStates';

const AddTenantModal = lazy(() => import('../../modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const RecordPaymentModal = lazy(() => import('../../modals/RecordPaymentModal').then((m) => ({ default: m.RecordPaymentModal })));

export function TenantsTab({ hostelId }: { hostelId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<string>('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'ACTIVE' })),
    staleTime: 2 * 60 * 1000,
  });

  const { data: invitedData, refetch: refetchInvited } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId, { status: 'INVITED' }),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'INVITED' })),
    staleTime: 2 * 60 * 1000,
  });

  const { mutate: resendInvite, isPending: resending } = useMutation({
    mutationFn: (email: string) => import('@features/tenants/api').then((m) => m.tenantService.resendInvitation(email)),
    onSuccess: () => { toast.success('Invitation resent'); refetchInvited(); },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to resend'),
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const tenants: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  const invitedTenants: Record<string, unknown>[] = Array.isArray(invitedData)
    ? invitedData
    : Array.isArray((invitedData as Record<string, unknown>)?.tenants)
    ? ((invitedData as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Active Tenants</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
        >
          <Plus className="w-3.5 h-3.5" /> Add Tenant
        </button>
      </div>

      <Link
        to={`/hostels/${hostelId}/tenants`}
        className="flex items-center justify-between p-3 rounded-xl border border-accent/30 bg-accent/5 text-sm font-medium text-accent"
      >
        Manage all tenants
        <ChevronRight className="w-4 h-4" />
      </Link>

      {invitedTenants.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Pending Invitations</h4>
            <span className="text-xs text-muted-foreground">{invitedTenants.length} waiting</span>
          </div>
          {invitedTenants.map((tenant) => {
            const email = String(tenant.email ?? tenant.tenant_email ?? '');
            const room = tenant.room_no ?? tenant.room_number ?? tenant.room;
            return (
              <div key={String(tenant.id)} className="bg-card border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-amber-500/10 text-amber-700">
                    {String(tenant.name ?? tenant.tenant_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground truncate">
                        {String(tenant.name ?? tenant.tenant_name ?? 'Invited tenant')}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                        Invited
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {email || 'No email available'}
                      {room ? ` · Room ${String(room)}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!email || resending}
                  onClick={() => email && resendInvite(email)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold active:scale-[0.98] transition-transform touch-manipulation disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  {resending ? 'Sending...' : 'Resend Invitation'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tenants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No active tenants</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first tenant to get started</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-95 transition-transform touch-manipulation"
          >
            Add Tenant
          </button>
        </div>
      )}
      {tenants.map((tenant) => {
        const paymentStatus = String(tenant.payment_status ?? 'unknown').toLowerCase();
        const isPaid = paymentStatus === 'paid';
        const isOverdue = paymentStatus === 'overdue';
        const dueAmt = Number(tenant.outstanding_amount ?? tenant.due_amount ?? tenant.dues ?? 0);
        const room = tenant.room_no ?? tenant.room_number ?? tenant.room;
        const dueDate = tenant.due_date ? new Date(String(tenant.due_date)) : null;
        const now = Date.now();
        const overdueDays = dueDate && dueDate.getTime() < now
          ? Math.floor((now - dueDate.getTime()) / 86400000)
          : 0;
        const tenantId = String(tenant.obligation_id ?? tenant.id ?? '');
        return (
          <div key={String(tenant.id)} className={`bg-card border rounded-xl p-4 min-w-0 ${
            isOverdue ? 'border-[#EF4444]/20' : 'border-border'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : isPaid ? 'bg-[#10B981]/10 text-[#10B981]'
                : 'bg-accent/10 text-accent'
              }`}>
                {String(tenant.name ?? 'T').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{String(tenant.name ?? '')}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isPaid ? 'bg-[#10B981]/10 text-[#10B981]'
                    : isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]'
                    : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}>
                    {isPaid ? 'Paid' : isOverdue ? (overdueDays > 0 ? `${overdueDays}d overdue` : 'Overdue') : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {room && <span className="text-xs text-muted-foreground">Room {String(room)}</span>}
                  {room && <span className="text-muted-foreground text-xs">·</span>}
                  <span className="text-xs text-muted-foreground">{fmtExact(tenant.monthly_rent ?? tenant.rent ?? 0)}/mo</span>
                </div>
                {!isPaid && dueAmt > 0 && (
                  <div className={`text-xs font-medium mt-1 ${
                    isOverdue ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                  }`}>
                    {fmt(dueAmt)} outstanding
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {tenant.phone && (
                  <a
                    href={`tel:${String(tenant.phone)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-muted-foreground active:scale-95 transition-transform"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            {!isPaid && (
              <button
                onClick={() => setShowPayment(tenantId)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 bg-accent text-accent-foreground rounded-lg text-xs font-semibold active:scale-[0.98] transition-transform touch-manipulation"
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                Record Payment
              </button>
            )}
          </div>
        );
      })}

      {showAdd && (
        <Suspense fallback={null}>
          <AddTenantModal hostelId={hostelId} onClose={() => setShowAdd(false)} />
        </Suspense>
      )}
      {showPayment && (
        <Suspense fallback={null}>
          <RecordPaymentModal
            hostelId={hostelId}
            initialDueId={showPayment}
            onClose={() => setShowPayment('')}
          />
        </Suspense>
      )}
    </div>
  );
}
