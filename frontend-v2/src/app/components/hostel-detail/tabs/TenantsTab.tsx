import { lazy, Suspense, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, CreditCard, Phone, Send, Search, Edit3, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { fmtExact } from '../shared/format';
import { TabError, TabSkeleton } from '../shared/TabStates';
import { getInitials, normalizeTenants } from '@features/tenants/utils/normalize';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';

const AddTenantModal = lazy(() => import('../../modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const RecordPaymentModal = lazy(() => import('../../modals/RecordPaymentModal').then((m) => ({ default: m.RecordPaymentModal })));
const EditInviteModal = lazy(() => import('../../modals/EditInviteModal').then((m) => ({ default: m.EditInviteModal })));

type TenantFilter = 'all' | 'due' | 'paid' | 'overdue' | 'unassigned';

const tenantFilters: { id: TenantFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'unassigned', label: 'Unassigned' },
];

export function TenantsTab({ hostelId }: { hostelId: string }) {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<{ tenantId: string; obligationId?: string; initialTenantData?: any } | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [resendOptionsTenant, setResendOptionsTenant] = useState<{ id: string; phone: string } | null>(null);
  const [showEditInvite, setShowEditInvite] = useState<string | null>(null);
  const actions = useTenantActions(hostelId);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'ACTIVE' })),
    staleTime: 2 * 60 * 1000,
  });

  const { data: invitedData } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId, { status: 'INVITED' }),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'INVITED' })),
    staleTime: 2 * 60 * 1000,
  });

  const tenants: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  const activeTenants = useMemo(() => normalizeTenants({ tenants }), [tenants]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeTenants.filter((tenant) => {
      const paymentStatus = tenant.paymentStatus.toLowerCase();
      const matchesFilter =
        filter === 'all' ||
        (filter === 'due' && tenant.outstandingAmount > 0) ||
        (filter === 'paid' && tenant.outstandingAmount <= 0) ||
        (filter === 'overdue' && paymentStatus === 'overdue') ||
        (filter === 'unassigned' && tenant.room === 'N/A');

      if (!matchesFilter) return false;
      if (!query) return true;

      return [tenant.name, tenant.email, tenant.phone, tenant.room, tenant.rollNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activeTenants, filter, search]);

  const invitedTenants: Record<string, unknown>[] = Array.isArray(invitedData)
    ? invitedData
    : Array.isArray((invitedData as Record<string, unknown>)?.tenants)
    ? ((invitedData as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const openTenantProfile = (tenantId: string) => {
    if (tenantId) navigate(`/hostels/${hostelId}/tenants/${tenantId}`);
  };

  const handleCardKeyDown = (event: KeyboardEvent, tenantId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTenantProfile(tenantId);
    }
  };

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

      {activeTenants.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, room..."
              className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
            />
          </label>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar">
            {tenantFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  filter === item.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {invitedTenants.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">Pending Invitations</h4>
            <span className="text-[10px] text-muted-foreground">{invitedTenants.length} waiting</span>
          </div>
          {invitedTenants.map((tenant) => {
            const invitedTenantId = String(tenant.id ?? tenant.tenant_id ?? '');
            const email = String(tenant.email ?? tenant.tenant_email ?? '');
            const phone = String(tenant.phone ?? tenant.tenant_phone ?? '');
            const identifier = email || phone;
            const room = tenant.room_no ?? tenant.room_number ?? tenant.room;

            // Reservation status badge styling
            const rsRaw = tenant.reservation_status as { status?: string; label?: string } | null;
            const rsStatus = rsRaw?.status ?? 'PAYMENT_PENDING';
            const rsLabel = rsRaw?.label ?? 'Invited';
            const badgeClass =
              rsStatus === 'MOVE_IN_READY'   ? 'bg-[#10B981]/10 text-[#059669]'
              : rsStatus === 'RESERVED'      ? 'bg-[#3B82F6]/10 text-[#2563EB]'
              : /* PAYMENT_PENDING / default */ 'bg-amber-500/10 text-amber-700';
            const avatarClass =
              rsStatus === 'MOVE_IN_READY'   ? 'bg-[#10B981]/10 text-[#059669]'
              : rsStatus === 'RESERVED'      ? 'bg-[#3B82F6]/10 text-[#2563EB]'
              : 'bg-amber-500/10 text-amber-700';

            return (
              <div
                key={String(tenant.id)}
                role="button"
                tabIndex={0}
                onClick={() => openTenantProfile(invitedTenantId)}
                onKeyDown={(event) => handleCardKeyDown(event, invitedTenantId)}
                className={`bg-card border rounded-xl p-3 cursor-pointer transition-colors hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                  rsStatus === 'MOVE_IN_READY' ? 'border-[#10B981]/30'
                  : rsStatus === 'RESERVED'    ? 'border-[#3B82F6]/30'
                  : 'border-amber-500/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${avatarClass}`}>
                      {String(tenant.name ?? tenant.tenant_name ?? 'T').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {String(tenant.name ?? tenant.tenant_name ?? 'Invited tenant')}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                          {rsLabel}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {email || phone || 'No identifier available'}
                        {room ? ` · Room ${String(room)}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!identifier || actions.resendInvite.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (identifier) {
                        setResendOptionsTenant({ id: invitedTenantId, phone: identifier });
                      }
                    }}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform touch-manipulation disabled:opacity-50 shrink-0"
                    title="Resend Invitation"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Resend</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTenants.length === 0 && (
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
      {activeTenants.length > 0 && filteredTenants.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
          <p className="font-medium text-foreground">No tenants match this view</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another search or filter.</p>
        </div>
      )}
      {filteredTenants.map((tenant) => {
        const paymentStatus = tenant.paymentStatus.toLowerCase();
        const isPaid = paymentStatus === 'paid';
        const isOverdue = paymentStatus === 'overdue';
        const dueAmt = tenant.outstandingAmount;
        const hasRoom = tenant.room && tenant.room !== 'N/A';
        const dueDate = tenant.dueDate ? new Date(String(tenant.dueDate)) : null;
        const now = Date.now();
        const overdueDays = dueDate && dueDate.getTime() < now
          ? Math.floor((now - dueDate.getTime()) / 86400000)
          : 0;
        const tenantId = tenant.id;
        const paymentTargetId = String(tenant.obligationId ?? tenant.id ?? '');
        return (
          <div
            key={tenant.id}
            role="button"
            tabIndex={0}
            onClick={() => openTenantProfile(tenantId)}
            onKeyDown={(event) => handleCardKeyDown(event, tenantId)}
            className={`bg-card border rounded-xl p-3 min-w-0 cursor-pointer transition-colors hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/30 ${
            isOverdue ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-border'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isOverdue ? 'bg-red-500/10 text-red-500'
                  : isPaid ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
                }`}>
                  {tenant.photoUrl ? (
                    <img src={tenant.photoUrl} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" />
                  ) : (
                    getInitials(tenant.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground truncate">{tenant.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isPaid ? 'bg-emerald-500/10 text-emerald-600'
                      : isOverdue ? 'bg-red-500/10 text-red-500'
                      : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {isPaid ? 'Paid' : isOverdue ? (overdueDays > 0 ? `${overdueDays}d overdue` : 'Overdue') : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{hasRoom ? `Room ${tenant.room}` : 'No Room'}</span>
                    <span>·</span>
                    <span>{fmtExact(tenant.rent)}/mo</span>
                    {!isPaid && dueAmt > 0 && (
                      <>
                        <span>·</span>
                        <span className={`font-semibold ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                          {fmtExact(dueAmt)} due
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {tenant.phone && tenant.phone !== 'N/A' && (
                  <a
                    href={`tel:${tenant.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-muted-foreground hover:bg-secondary rounded-xl active:scale-95 transition-transform"
                    title="Call Tenant"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {!isPaid && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowPayment({
                        tenantId: tenant.id,
                        obligationId: tenant.obligationId || undefined,
                        initialTenantData: {
                          id: tenant.id,
                          name: tenant.name,
                          phone: tenant.phone,
                          room_number: tenant.room,
                          outstanding: tenant.outstandingAmount,
                        }
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 active:scale-95 transition-transform"
                    title="Record Payment"
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Pay</span>
                  </button>
                )}
              </div>
            </div>
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
            context={{
              tenantId: showPayment.tenantId,
              obligationId: showPayment.obligationId,
              source: 'activity-center',
            }}
            initialTenantData={showPayment.initialTenantData}
            onClose={() => setShowPayment(null)}
          />
        </Suspense>
      )}

      {resendOptionsTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setResendOptionsTenant(null)}>
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 m-4 transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-accent" />
                  Resend Options
                </h3>
                <button onClick={() => setResendOptionsTenant(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose how you want to resend the invitation. You can resend with current parameters or edit details before sending.
              </p>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const identifier = resendOptionsTenant.phone;
                    setResendOptionsTenant(null);
                    actions.resendInvite.mutate(identifier);
                  }}
                  className="flex items-center gap-3 w-full p-3 bg-secondary/30 hover:bg-secondary/60 active:bg-secondary/80 rounded-xl border border-border/50 transition-all text-left animate-none"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-foreground">Direct Resend</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">Send invitation using current details</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const tenantId = resendOptionsTenant.id;
                    setResendOptionsTenant(null);
                    setShowEditInvite(tenantId);
                  }}
                  className="flex items-center gap-3 w-full p-3 bg-secondary/30 hover:bg-secondary/60 active:bg-secondary/80 rounded-xl border border-border/50 transition-all text-left animate-none"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-foreground">Edit &amp; Resend</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">Modify room, rent, or agreement before sending</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditInvite && (
        <Suspense fallback={null}>
          <EditInviteModal
            hostelId={hostelId}
            tenantId={showEditInvite}
            onClose={() => setShowEditInvite(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
