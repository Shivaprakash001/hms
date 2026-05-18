import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Users, DollarSign, BedDouble, Receipt, Loader2, AlertCircle, Plus, CreditCard, Phone } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { dashboardService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { AddTenantModal } from './modals/AddTenantModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';

type Tab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'expenses' | 'moveouts';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'financials', label: 'Financials' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'moveouts', label: 'Move-Outs' },
];

export function HostelDetailView() {
  const { hostelId, tab } = useParams<{ hostelId: string; tab?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>((tab as Tab) || 'overview');

  const { data: hostels = [] } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostelList = Array.isArray(hostels) ? hostels : (hostels as { hostels?: unknown[] })?.hostels || [];
  const hostel = hostelList.find((h: { id: string }) => h.id === hostelId);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(hostelId!),
    queryFn: () => dashboardService.getStats(hostelId!),
    enabled: !!hostelId,
    staleTime: 2 * 60 * 1000,
  });

  if (!hostelId) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border z-10">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/hostels')}
              className="p-2 -ml-2 shrink-0 active:scale-95 transition-transform touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-foreground truncate">
                {hostel ? (hostel as { name: string }).name : 'Hostel'}
              </h1>
              {hostel && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{(hostel as { address?: string; city?: string }).address || (hostel as { city?: string }).city || ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors touch-manipulation ${
                  activeTab === t.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground active:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 min-w-0">
        {activeTab === 'overview' && <OverviewTab hostelId={hostelId} stats={stats} loading={statsLoading} />}
        {activeTab === 'rooms' && <RoomsTab hostelId={hostelId} />}
        {activeTab === 'tenants' && <TenantsTab hostelId={hostelId} />}
        {activeTab === 'financials' && <FinancialsTab hostelId={hostelId} />}
        {activeTab === 'expenses' && <ExpensesTab hostelId={hostelId} />}
        {activeTab === 'moveouts' && <MoveOutsTab hostelId={hostelId} />}
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 h-20" />
      ))}
    </div>
  );
}

function TabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load data</p>
      <button onClick={onRetry} className="text-xs text-accent font-medium">
        Retry
      </button>
    </div>
  );
}

function fmt(amount: unknown): string {
  const n = Number(amount || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function OverviewTab({ hostelId, stats, loading }: { hostelId: string; stats: Record<string, unknown> | undefined; loading: boolean }) {
  if (loading) return <TabSkeleton />;

  const occupancy = Number(stats?.occupancy_rate ?? stats?.occupancyRate ?? 0);
  const occupiedRooms = Number(stats?.occupied_rooms ?? stats?.occupiedRooms ?? 0);
  const totalRooms = Number(stats?.total_rooms ?? stats?.totalRooms ?? 0);
  const revenue = Number(stats?.total_revenue ?? stats?.totalRevenue ?? stats?.monthly_revenue ?? 0);
  const activeTenants = Number(stats?.active_tenants ?? stats?.activeTenants ?? 0);
  const pendingDues = Number(stats?.pending_dues ?? stats?.pendingDues ?? stats?.overdue_count ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Occupancy', icon: <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />, value: `${occupancy.toFixed(0)}%`, sub: `${occupiedRooms}/${totalRooms} rooms` },
          { label: 'Revenue', icon: <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />, value: fmt(revenue), sub: 'This month' },
          { label: 'Active Tenants', icon: <Users className="w-4 h-4 text-muted-foreground shrink-0" />, value: String(activeTenants), sub: 'Currently staying' },
          { label: 'Pending Dues', icon: <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />, value: String(pendingDues), sub: 'Requires attention', accent: true },
        ].map(({ label, icon, value, sub, accent }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 min-w-0">
            <div className="flex items-center justify-between mb-2 gap-1">
              <span className="text-xs text-muted-foreground truncate">{label}</span>
              {icon}
            </div>
            <div className="text-lg font-semibold text-foreground truncate">{value}</div>
            <div className={`text-[10px] mt-1 truncate ${accent ? 'text-[#F59E0B]' : 'text-muted-foreground'}`}>{sub}</div>
          </div>
        ))}
      </div>

      {!stats && (
        <div className="text-center py-8 text-sm text-muted-foreground">No stats available</div>
      )}
    </div>
  );
}

function RoomsTab({ hostelId }: { hostelId: string }) {
  const [showAddTenant, setShowAddTenant] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.rooms.list(hostelId),
    queryFn: () => import('@features/rooms/api').then((m) => m.roomService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const rooms: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const vacantRooms = rooms.filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'vacant' || s === 'available' || s === '';
  });
  const occupiedRooms = rooms.filter((r) => String(r.status || '').toLowerCase() === 'occupied');
  const maintenanceRooms = rooms.filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'maintenance' || s === 'under_maintenance';
  });

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
          <BedDouble className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">No rooms added</p>
          <p className="text-sm text-muted-foreground mt-1">Add rooms to start managing occupancy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vacancy headline */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-3 min-w-0">
          <div className="text-lg font-semibold text-[#10B981]">{occupiedRooms.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Occupied</div>
        </div>
        <div className={`rounded-xl p-3 min-w-0 ${
          vacantRooms.length > 0 ? 'bg-[#3B82F6]/8 border border-[#3B82F6]/20' : 'bg-card border border-border'
        }`}>
          <div className={`text-lg font-semibold ${
            vacantRooms.length > 0 ? 'text-[#3B82F6]' : 'text-foreground'
          }`}>{vacantRooms.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Vacant</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 min-w-0">
          <div className="text-lg font-semibold text-foreground">{maintenanceRooms.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Maint.</div>
        </div>
      </div>

      {vacantRooms.length > 0 && (
        <button
          onClick={() => setShowAddTenant(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-accent/10 border border-accent/20 text-accent rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          Fill {vacantRooms.length} vacant room{vacantRooms.length > 1 ? 's' : ''}
        </button>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{rooms.length} rooms</h3>
        {rooms.map((room) => {
          const status = String(room.status || 'vacant').toLowerCase();
          const isOccupied = status === 'occupied';
          const isMaintenance = status === 'maintenance' || status === 'under_maintenance';
          const isVacant = !isOccupied && !isMaintenance;
          return (
            <div key={String(room.id)} className={`bg-card border rounded-xl p-4 min-w-0 ${
              isVacant ? 'border-[#3B82F6]/15' : 'border-border'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">Room {String(room.room_number ?? room.number ?? room.room_no ?? '')}</div>
                  {room.room_type || room.type ? (
                    <div className="text-xs text-muted-foreground mt-0.5">{String(room.room_type ?? room.type ?? '')}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                    isOccupied ? 'bg-[#10B981]/10 text-[#10B981]' :
                    isMaintenance ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                    'bg-[#3B82F6]/10 text-[#3B82F6]'
                  }`}>
                    {isOccupied ? 'Occupied' : isMaintenance ? 'Maintenance' : 'Vacant'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">
                  {isOccupied
                    ? (room.tenant_name ? String(room.tenant_name) : 'Tenant assigned')
                    : isMaintenance ? 'Under maintenance'
                    : 'Ready to assign'}
                </span>
                <span className="font-medium text-foreground text-xs">{fmt(room.monthly_rent ?? room.rent ?? 0)}/mo</span>
              </div>
              {isVacant && (
                <button
                  onClick={() => setShowAddTenant(true)}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 bg-card border border-border rounded-lg text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Tenant
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showAddTenant && <AddTenantModal hostelId={hostelId} onClose={() => setShowAddTenant(false)} />}
    </div>
  );
}

function TenantsTab({ hostelId }: { hostelId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<string>('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'ACTIVE' })),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const tenants: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
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
                  <span className="text-xs text-muted-foreground">{fmt(tenant.monthly_rent ?? tenant.rent ?? 0)}/mo</span>
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

      {showAdd && <AddTenantModal hostelId={hostelId} onClose={() => setShowAdd(false)} />}
      {showPayment && (
        <RecordPaymentModal
          hostelId={hostelId}
          initialDueId={showPayment}
          onClose={() => setShowPayment('')}
        />
      )}
    </div>
  );
}

function FinancialsTab({ hostelId }: { hostelId: string }) {
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const { data: payments, isLoading: pLoading, isError: pError, refetch: pRefetch } = useQuery({
    queryKey: queryKeys.payments.ledger(hostelId, { limit: 20 }),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAll(hostelId, { limit: 20 })),
    staleTime: 2 * 60 * 1000,
  });
  const { data: dues, isLoading: dLoading } = useQuery({
    queryKey: queryKeys.payments.dues(hostelId),
    queryFn: () => import('@features/payments/api').then((m) => m.paymentService.getAllDues(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  if (pLoading || dLoading) return <TabSkeleton />;
  if (pError) return <TabError onRetry={pRefetch} />;

  const paymentList: Record<string, unknown>[] = Array.isArray(payments)
    ? payments
    : Array.isArray((payments as Record<string, unknown>)?.payments)
    ? ((payments as Record<string, unknown>).payments as Record<string, unknown>[])
    : [];

  const duesList: Record<string, unknown>[] = Array.isArray(dues) ? dues : [];
  const totalPending = duesList.reduce((sum, d) => sum + Number(d.amount ?? d.outstanding ?? 0), 0);
  const totalCollected = paymentList.reduce((sum, p) => sum + Number(p.amount_paid ?? p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Financials</h3>
        <button
          onClick={() => setShowRecordPayment(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent active:scale-95 transition-transform"
        >
          <Plus className="w-3.5 h-3.5" /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Collected</div>
          <div className="text-xl font-semibold text-foreground">{fmt(totalCollected)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Recent payments</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Pending Dues</div>
          <div className="text-xl font-semibold text-[#F59E0B]">{fmt(totalPending)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{duesList.length} obligations</div>
        </div>
      </div>

      {showRecordPayment && (
        <RecordPaymentModal hostelId={hostelId} onClose={() => setShowRecordPayment(false)} />
      )}

      {paymentList.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {paymentList.slice(0, 10).map((p) => (
              <div key={String(p.id)} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{String(p.tenant_name ?? p.name ?? 'Tenant')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.payment_date ? new Date(String(p.payment_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{fmt(p.amount_paid ?? p.amount)}</div>
                  <div className="text-[10px] text-[#10B981] mt-0.5">Received</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpensesTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.expenses.list(hostelId),
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const expenses: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.expenses)
    ? ((data as Record<string, unknown>).expenses as Record<string, unknown>[])
    : [];

  const total = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  if (expenses.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">No expenses recorded</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-1">Total Expenses</div>
        <div className="text-2xl font-semibold text-foreground">{fmt(total)}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{expenses.length} transactions</div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Expense History</h3>
        <div className="space-y-2">
          {expenses.map((expense, i) => (
            <div key={String(expense.id ?? i)} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-sm font-medium text-foreground">{String(expense.category ?? expense.expense_type ?? 'Expense')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{String(expense.description ?? expense.notes ?? '')}</div>
                </div>
                <div className="text-sm font-semibold text-foreground">{fmt(expense.amount)}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {expense.expense_date ? new Date(String(expense.expense_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveOutsTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(hostelId, { status: 'LEFT' }),
    queryFn: () => import('@features/tenants/api').then((m) => m.tenantService.getAll(hostelId, { status: 'LEFT', limit: 20 })),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const moveouts: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.tenants)
    ? ((data as Record<string, unknown>).tenants as Record<string, unknown>[])
    : [];

  if (moveouts.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">No recent move-outs</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Recent Move-Outs</h3>
        <span className="text-xs text-muted-foreground">{moveouts.length} tenants</span>
      </div>
      {moveouts.map((moveout, i) => {
        const leftDate = String(moveout.move_out_date ?? moveout.left_at ?? moveout.updated_at ?? '');
        const deposit = Number(moveout.deposit_amount ?? moveout.advance_paid ?? 0);
        return (
          <div key={String(moveout.id ?? i)} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-foreground">{String(moveout.name ?? '')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Room {String(moveout.room_no ?? moveout.room_number ?? '')}</div>
              </div>
              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-[#6B7280]/10 text-[#6B7280]">
                Left
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">
                {leftDate ? new Date(leftDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </span>
              {deposit > 0 && <span className="font-medium text-foreground">Deposit: {fmt(deposit)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
