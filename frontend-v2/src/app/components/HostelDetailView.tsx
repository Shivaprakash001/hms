import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Users, DollarSign, BedDouble, Receipt, AlertCircle, Plus, CreditCard, Phone, Wifi, FileText, Eye, EyeOff, Copy, Check, Pencil, Layers, ChevronDown, ChevronRight, X, Trash2, MoreVertical, TrendingUp, TrendingDown, Sparkles, Search, CalendarDays, Repeat2, Upload, Zap, Activity, AlertTriangle, BellRing, ClipboardCheck, Flame, Home, IndianRupee, Megaphone, UserPlus, Send, Loader2 } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { dashboardService } from '@features/dashboard/api';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { AddTenantModal } from './modals/AddTenantModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';
import { FinancialControlCenter } from './views/billing/FinancialControlCenter';
import { TransferRoomSheet } from '@features/tenants/components/allocation/TransferRoomSheet';

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
              onClick={() => navigate('/dashboard')}
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

function BedOccupancyBlocks({ occupied, capacity, hasDues = false }: { occupied: number; capacity: number; hasDues?: boolean }) {
  const beds = Array.from({ length: Math.max(1, capacity || 1) });
  return (
    <div className="flex flex-wrap gap-1.5">
      {beds.map((_, index) => {
        const filled = index < occupied;
        return (
          <span
            key={index}
            className={[
              'h-5 w-4 rounded-[4px] border',
              filled && hasDues ? 'border-[#F59E0B] bg-[#F59E0B]' : '',
              filled && !hasDues ? 'border-[#10B981] bg-[#10B981]' : '',
              !filled ? 'border-border bg-background' : '',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

function OverviewTab({ hostelId, stats, loading }: { hostelId: string; stats: Record<string, unknown> | undefined; loading: boolean }) {
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  if (loading) return <TabSkeleton />;

  const s = (stats?.data ?? stats ?? {}) as any;
  const intel = s.intelligence ?? {};
  const kpis = intel.kpis ?? {};
  const hostel = s.hostel ?? {};
  const health = intel.health ?? {};
  const revenueTrend = intel.revenue?.trend ?? [];
  const roomUtilization = intel.occupancy?.room_utilization ?? [];
  const floorOccupancy = intel.occupancy?.floor_occupancy ?? [];
  const highRiskTenants = intel.dues?.high_risk_tenants ?? [];
  const expenseCategories = intel.expenses?.categories ?? [];
  const tenantMovement = intel.tenant_movement ?? {};
  const alerts = intel.alerts ?? [];
  const activity = intel.recent_activity ?? [];
  const occupancy = Number(s.occupancy_rate ?? 0);
  const activeTenants = Number(s.active_tenants ?? 0);
  const totalCapacity = Number(s.total_capacity ?? 0);
  const vacantBeds = Number(s.vacant_beds ?? Math.max(totalCapacity - activeTenants, 0));
  const score = Number(s.operational_score ?? health.score ?? 0);
  const profitability = String(s.profitability_status ?? health.profitability_status ?? 'Attention Needed');
  const maxTrend = Math.max(1, ...revenueTrend.flatMap((m: any) => [Number(m.expected || 0), Number(m.collected || 0), Number(m.profit || 0)]).map(Math.abs));
  const action = (tab: Tab) => navigate(`/hostels/${hostelId}/${tab}`);
  const stateClass = (state: string) =>
    state === 'Critical' || state === 'Dangerous' || state === 'loss' ? 'text-destructive bg-destructive/10 border-destructive/20'
      : state === 'At Risk' || state === 'Attention Needed' || state === 'unstable' ? 'text-[#B45309] bg-[#F59E0B]/10 border-[#F59E0B]/20'
        : 'text-[#047857] bg-[#10B981]/10 border-[#10B981]/20';

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-[93px] z-[5] -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{hostel.name || 'Hostel command center'}</h2>
              <span className="shrink-0 rounded-full bg-[#10B981]/10 text-[#047857] px-2 py-0.5 text-[10px] font-semibold">{hostel.status || 'Active'}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{hostel.location || 'Location not set'}</span>
            </div>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-right ${stateClass(profitability)}`}>
            <div className="text-lg font-black leading-none">{score}</div>
            <div className="text-[10px] font-semibold">{profitability}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Tenant', icon: UserPlus, onClick: () => action('tenants') },
            { label: 'Expense', icon: Receipt, onClick: () => action('expenses') },
            { label: 'Collect', icon: CreditCard, onClick: () => action('financials') },
            { label: 'Call', icon: Phone, onClick: () => hostel.phone && window.open(`tel:${hostel.phone}`) },
          ].map((item) => (
            <button key={item.label} onClick={item.onClick} className="h-10 rounded-xl bg-card border border-border text-[11px] font-semibold text-foreground flex items-center justify-center gap-1 active:scale-[0.98]">
              <item.icon className="w-3.5 h-3.5" /> {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <OperationalKpi title="Occupancy Health" value={`${occupancy}%`} icon={<BedDouble className="w-4 h-4" />} state={kpis.occupancy?.value > 90 ? 'Healthy' : kpis.occupancy?.value < 60 ? 'Dangerous' : 'Moderate'} detail={`${activeTenants}/${totalCapacity} beds · ${vacantBeds} vacant`} insight={kpis.occupancy?.insight} trend={kpis.occupancy?.trend} />
        <OperationalKpi title="Monthly Revenue" value={fmt(kpis.revenue?.collected ?? s.total_revenue)} icon={<IndianRupee className="w-4 h-4" />} state={`${kpis.revenue?.collection_rate ?? s.collection_rate ?? 0}% collected`} detail={`${fmt(kpis.revenue?.expected ?? s.expected_revenue)} expected`} insight={kpis.revenue?.insight} trend={kpis.revenue?.trend} />
        <OperationalKpi title="Net Profit" value={fmt(kpis.profit?.amount ?? s.net_profit)} icon={<TrendingUp className="w-4 h-4" />} state={`${kpis.profit?.margin ?? s.profit_margin ?? 0}% margin`} detail={Number(kpis.profit?.amount ?? s.net_profit) < 0 ? 'Loss this month' : 'Profit this month'} insight={kpis.profit?.insight} trend={kpis.profit?.trend} />
        <OperationalKpi title="Pending Dues Risk" value={fmt(kpis.dues?.pending ?? s.pending_dues)} icon={<AlertTriangle className="w-4 h-4" />} state={`${kpis.dues?.overdue_tenants ?? s.overdue_count ?? 0} overdue`} detail={kpis.dues?.oldest_unpaid_due ? `Oldest ${new Date(kpis.dues.oldest_unpaid_due).toLocaleDateString('en-IN')}` : 'No overdue aging'} insight={kpis.dues?.insight} danger />
        <OperationalKpi title="Expense Burn" value={fmt(kpis.expenses?.amount ?? s.expenses_this_month)} icon={<Flame className="w-4 h-4" />} state={`${kpis.expenses?.ratio ?? s.expense_revenue_ratio ?? 0}% of revenue`} detail={kpis.expenses?.top_category?.category || 'No category yet'} insight={kpis.expenses?.insight} trend={intel.expenses?.growth} />
        <OperationalKpi title="Tenant Stability" value={`${kpis.tenant_stability?.churn_rate ?? s.tenant_churn_rate ?? 0}%`} icon={<Users className="w-4 h-4" />} state="Churn rate" detail={`${kpis.tenant_stability?.new_joins ?? 0} joins · ${kpis.tenant_stability?.exits ?? 0} exits`} insight={kpis.tenant_stability?.insight} />
      </section>

      <OverviewSectionTitle title="Revenue Intelligence" action="Open billing" onClick={() => action('financials')} />
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-end gap-2 h-28">
          {revenueTrend.length === 0 ? <OverviewEmptyMini text="Start collecting rent to build revenue trend." /> : revenueTrend.map((m: any) => (
            <div key={m.month} className="flex-1 h-full flex flex-col justify-end gap-1">
              <div className="rounded-t bg-[#10B981] min-h-1" style={{ height: `${Math.max(3, (Number(m.collected || 0) / maxTrend) * 100)}%` }} />
              <div className="rounded-t bg-[#F59E0B] min-h-1" style={{ height: `${Math.max(3, (Number(m.expected || 0) / maxTrend) * 60)}%` }} />
              <span className="text-[9px] text-muted-foreground text-center">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniMetric label="Collection" value={`${s.collection_rate ?? 0}%`} />
          <MiniMetric label="Delay" value={`${intel.revenue?.collection_efficiency?.average_payment_delay_days ?? 0}d`} />
          <MiniMetric label="/ Bed" value={fmt(s.revenue_per_occupied_bed)} />
        </div>
      </div>

      <OverviewSectionTitle title="Occupancy Intelligence" action="Rooms" onClick={() => action('rooms')} />
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {roomUtilization.length === 0 ? <div className="col-span-6"><OverviewEmptyMini text="Add rooms to see utilization heatmap." /></div> : roomUtilization.slice(0, 36).map((room: any) => (
            <div key={room.id} title={room.room_no} className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold border ${
              room.state === 'full' ? 'bg-[#10B981]/15 text-[#047857] border-[#10B981]/25' : room.state === 'partial' ? 'bg-[#F59E0B]/15 text-[#B45309] border-[#F59E0B]/25' : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {room.room_no}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Full" value={String(intel.occupancy?.summary?.full_rooms ?? 0)} />
          <MiniMetric label="Partial" value={String(intel.occupancy?.summary?.partial_rooms ?? 0)} />
          <MiniMetric label="Vacant" value={String(intel.occupancy?.summary?.vacant_rooms ?? 0)} />
        </div>
        {floorOccupancy.slice(0, 4).map((floor: any) => (
          <ProgressRow key={floor.floor} label={floor.floor} value={floor.occupancy_rate} />
        ))}
      </div>

      <OverviewSectionTitle title="Dues & Collection Risk" action="Collect" onClick={() => action('financials')} />
      <div className="grid grid-cols-2 gap-3">
        <MiniPanel title="Dues summary" icon={<Receipt className="w-4 h-4" />}>
          <MiniMetric label="Total" value={fmt(intel.dues?.summary?.total_dues)} />
          <MiniMetric label="Overdue" value={fmt(intel.dues?.summary?.overdue_dues)} />
          <MiniMetric label="This week" value={fmt(intel.dues?.summary?.due_this_week)} />
        </MiniPanel>
        <MiniPanel title="Reminder conversion" icon={<BellRing className="w-4 h-4" />}>
          <MiniMetric label="Sent" value={String(intel.dues?.reminder_conversion?.sent ?? 0)} />
          <MiniMetric label="Converted" value={`${intel.dues?.reminder_conversion?.conversion_rate ?? 0}%`} />
          <MiniMetric label="Best" value={intel.dues?.reminder_conversion?.best_channel || 'N/A'} />
        </MiniPanel>
      </div>
      <SmartList items={highRiskTenants.map((t: any) => ({ title: t.tenant_name, right: fmt(t.balance), sub: `${t.days_overdue} days overdue · ${t.risk}` }))} empty="No high-risk tenants right now. Keep reminders active." />

      <OverviewSectionTitle title="Expense Intelligence" action="Expenses" onClick={() => action('expenses')} />
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="/ Tenant" value={fmt(s.expense_per_tenant)} />
          <MiniMetric label="Growth" value={`${intel.expenses?.growth ?? 0}%`} />
          <MiniMetric label="Fixed" value={`${intel.expenses?.fixed_variable_ratio ?? 0}%`} />
        </div>
        {expenseCategories.length === 0 ? <OverviewEmptyMini text="Track operational costs to understand profitability." /> : expenseCategories.slice(0, 4).map((cat: any) => (
          <ProgressRow key={cat.category} label={cat.category} value={cat.percentage} right={fmt(cat.amount)} />
        ))}
      </div>

      <OverviewSectionTitle title="Tenant Movement" action="Tenants" onClick={() => action('tenants')} />
      <div className="grid grid-cols-4 gap-2">
        <MiniMetric label="Joins" value={String(tenantMovement.recent_joins ?? 0)} card />
        <MiniMetric label="Move-outs" value={String(tenantMovement.move_out_requests ?? 0)} card />
        <MiniMetric label="Pending" value={String(tenantMovement.pending_onboarding ?? 0)} card />
        <MiniMetric label="Inactive" value={String(tenantMovement.inactive_invitations ?? 0)} card />
      </div>

      <OverviewSectionTitle title="Alerts & Action Center" />
      <div className="space-y-2">
        {alerts.length === 0 ? <EmptyState title="No urgent action today" text="The hostel is operationally stable. Keep tracking collections, occupancy and expenses daily." /> : alerts.map((alert: any, i: number) => (
          <div key={`${alert.title}-${i}`} className={`rounded-xl border p-3 ${alert.severity === 'critical' ? 'border-destructive/25 bg-destructive/10' : alert.severity === 'warning' ? 'border-[#F59E0B]/25 bg-[#F59E0B]/10' : 'border-border bg-card'}`}>
            <div className="flex items-start gap-2">
              <AlertCircle className={`w-4 h-4 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-[#B45309]'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{alert.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{alert.impact}</div>
                <div className="text-xs text-foreground mt-2">{alert.action}</div>
              </div>
              <button className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-1 rounded-lg">{alert.cta}</button>
            </div>
          </div>
        ))}
      </div>

      <OverviewSectionTitle title="Recent Operational Activity" />
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {activity.length === 0 ? <div className="p-4"><OverviewEmptyMini text="Activity will appear as payments, allocations, expenses and reminders happen." /></div> : activity.map((item: any, i: number) => (
          <div key={`${item.title}-${i}`} className="p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              {item.type === 'payment' ? <IndianRupee className="w-4 h-4 text-[#047857]" /> : item.type === 'expense' ? <Receipt className="w-4 h-4 text-[#B45309]" /> : item.type === 'allocation' ? <Home className="w-4 h-4 text-accent" /> : <Activity className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
              <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
            </div>
            <div className="text-[10px] text-muted-foreground shrink-0">{item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</div>
          </div>
        ))}
      </div>

      <div className="fixed right-4 bottom-20 z-20">
        {fabOpen && (
          <div className="mb-2 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            {[
              { label: 'Add Tenant', icon: UserPlus, onClick: () => action('tenants') },
              { label: 'Add Expense', icon: Receipt, onClick: () => action('expenses') },
              { label: 'Record Payment', icon: CreditCard, onClick: () => action('financials') },
              { label: 'Create Reminder', icon: Megaphone, onClick: () => action('financials') },
              { label: 'Allocate Room', icon: Home, onClick: () => action('rooms') },
            ].map((item) => (
              <button key={item.label} onClick={item.onClick} className="w-44 px-4 py-3 text-sm text-left flex items-center gap-2 hover:bg-secondary">
                <item.icon className="w-4 h-4 text-muted-foreground" /> {item.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setFabOpen((v) => !v)} className="w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center active:scale-95">
          {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {!stats && (
        <EmptyState title="Start building hostel intelligence" text="Add rooms, invite tenants, record collections and track expenses to turn this page into a live command center." />
      )}
    </div>
  );
}

function OverviewSectionTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {action && <button onClick={onClick} className="text-xs font-semibold text-accent">{action}</button>}
    </div>
  );
}

function OperationalKpi({ title, value, icon, state, detail, insight, trend, danger }: any) {
  const isBad = danger || String(state).includes('Danger') || String(state).includes('overdue') || Number(trend) < -10;
  return (
    <div className={`bg-card border rounded-xl p-3 min-w-0 ${isBad ? 'border-destructive/25' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-[11px] font-medium truncate">{title}</span>
        {icon}
      </div>
      <div className="mt-2 text-xl font-black text-foreground truncate">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold truncate ${isBad ? 'text-destructive' : 'text-muted-foreground'}`}>{state}</span>
        {trend !== undefined && <span className={`text-[10px] font-bold ${Number(trend) >= 0 ? 'text-[#047857]' : 'text-destructive'}`}>{Number(trend) >= 0 ? '+' : ''}{trend}%</span>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 truncate">{detail}</div>
      {insight && <div className="mt-2 text-[10px] text-foreground bg-secondary rounded-lg px-2 py-1 line-clamp-2">{insight}</div>}
    </div>
  );
}

function MiniMetric({ label, value, card }: { label: string; value: string; card?: boolean }) {
  return (
    <div className={`${card ? 'bg-card border border-border rounded-xl p-3' : 'bg-secondary/60 rounded-lg p-2'} min-w-0`}>
      <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      <div className="text-sm font-bold text-foreground truncate">{value}</div>
    </div>
  );
}

function MiniPanel({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-0">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
        <span className="truncate">{title}</span>{icon}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ProgressRow({ label, value, right }: { label: string; value: number; right?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground font-medium truncate">{label}</span>
        <span className="text-muted-foreground shrink-0">{right || `${value}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function OverviewEmptyMini({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground bg-secondary/60 rounded-lg p-3">{text}</div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 text-center">
      <ClipboardCheck className="w-8 h-8 text-accent mx-auto mb-2" />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{text}</div>
    </div>
  );
}

function SmartList({ items, empty }: { items: { title: string; right: string; sub: string }[]; empty: string }) {
  if (!items.length) return <OverviewEmptyMini text={empty} />;
  return (
    <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
      {items.map((item) => (
        <div key={`${item.title}-${item.right}`} className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{item.title}</div>
            <div className="text-xs text-muted-foreground truncate">{item.sub}</div>
          </div>
          <div className="text-sm font-bold text-destructive shrink-0">{item.right}</div>
        </div>
      ))}
    </div>
  );
}

// ─── WiFi reveal cell ────────────────────────────────────────────────────────
function WifiCell({ wifiName, wifiPassword }: { wifiName: string | null; wifiPassword: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!wifiName && !wifiPassword) return null;

  const handleCopy = () => {
    if (wifiPassword) {
      navigator.clipboard.writeText(wifiPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <Wifi className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground truncate flex-1">{wifiName || '—'}</span>
      {wifiPassword && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono text-foreground">
            {revealed ? wifiPassword : '••••••••'}
          </span>
          <button onClick={() => setRevealed((v) => !v)} className="p-1 text-muted-foreground active:scale-90">
            {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button onClick={handleCopy} className="p-1 text-muted-foreground active:scale-90">
            {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Room Form Modal (create + edit + delete) ────────────────────────────────
function RoomFormModal({
  room,
  defaultFloorId = '',
  floors,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting = false,
}: {
  room: Record<string, unknown> | null;
  defaultFloorId?: string;
  floors: Record<string, unknown>[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  saving: boolean;
  deleting?: boolean;
}) {
  const isEdit = room !== null;
  const [form, setForm] = useState({
    room_no:       isEdit ? String(room!.room_no ?? '') : '',
    capacity:      isEdit ? String(room!.capacity ?? '1') : '1',
    base_rent:     isEdit ? String(room!.base_rent ?? room!.monthly_rent ?? '') : '',
    floor_id:      isEdit ? String(room!.floor_id ?? '') : defaultFloorId,
    wifi_name:     isEdit ? String(room!.wifi_name ?? '') : '',
    wifi_password: isEdit ? String(room!.wifi_password ?? '') : '',
    notes:         isEdit ? String(room!.notes ?? '') : '',
  });
  const [showWifi, setShowWifi] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      room_no:       form.room_no,
      capacity:      Number(form.capacity),
      base_rent:     form.base_rent ? Number(form.base_rent) : undefined,
      floor_id:      form.floor_id || undefined,
      wifi_name:     form.wifi_name || null,
      wifi_password: form.wifi_password || null,
      notes:         form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl border-t border-border max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground text-sm">{isEdit ? 'Edit Room' : 'Add Room'}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 pb-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Room Name</label>
              <input value={form.room_no} onChange={set('room_no')} required placeholder="e.g. 101, A1"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capacity (beds)</label>
              <input type="number" min={1} max={20} value={form.capacity} onChange={set('capacity')} required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Monthly Rent (₹)</label>
              <input type="number" min={0} value={form.base_rent} onChange={set('base_rent')} placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Floor</label>
              <select value={form.floor_id} onChange={set('floor_id')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="">— No floor —</option>
                {floors.map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>{String(f.name)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={set('notes') as any}
              placeholder="Attached bathroom, AC, balcony…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>

          <div>
            <button type="button" onClick={() => setShowWifi((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2">
              <Wifi className="w-3.5 h-3.5" />
              WiFi credentials
              {showWifi ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {showWifi && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Network name (SSID)</label>
                  <input value={form.wifi_name} onChange={set('wifi_name')} placeholder="MyHostel_WiFi"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                  <input type="text" value={form.wifi_password} onChange={set('wifi_password')} placeholder="Tap to enter"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add Room'}
          </button>

          {isEdit && onDelete && (
            !confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-xs text-destructive font-medium rounded-xl border border-destructive/20 active:bg-destructive/5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Room
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 text-xs font-medium rounded-xl border border-border text-muted-foreground">
                  Cancel
                </button>
                <button type="button" onClick={onDelete} disabled={deleting}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            )
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Floor Name Modal (add or rename) ───────────────────────────────────────
function FloorNameModal({
  title,
  initialName = '',
  submitLabel,
  onClose,
  onSubmit,
  busy,
}: {
  title: string;
  initialName?: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground text-sm">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ground Floor, Boys Wing A…"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent mb-3"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); onSubmit(name.trim()); } }}
        />
        <button
          disabled={!name.trim() || busy}
          onClick={() => onSubmit(name.trim())}
          className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-semibold disabled:opacity-40">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Floor Actions Sheet (kebab menu) ────────────────────────────────────────
function FloorActionsSheet({
  floor,
  onClose,
  onRename,
  onDelete,
  deleting,
}: {
  floor: { id: string; name: string };
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">{floor.name}</p>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <button onClick={() => { onClose(); onRename(); }}
          className="w-full flex items-center gap-3 py-3 px-1 text-sm text-foreground active:bg-secondary rounded-lg">
          <Pencil className="w-4 h-4 text-muted-foreground" /> Rename Floor
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-3 py-3 px-1 text-sm text-destructive active:bg-destructive/5 rounded-lg">
            <Trash2 className="w-4 h-4" /> Delete Floor
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground px-1">Only empty floors can be deleted. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl border border-border text-muted-foreground">
                Cancel
              </button>
              <button onClick={onDelete} disabled={deleting}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RoomOverviewModalProps {
  hostelId: string;
  roomId: string;
  onClose: () => void;
  onEditRoom: (room: Record<string, unknown>) => void;
  onTransferTenant: (tenantId: string) => void;
}

function RoomOverviewModal({ hostelId, roomId, onClose, onEditRoom, onTransferTenant }: RoomOverviewModalProps) {
  const { data: overviewRaw, isLoading, error } = useQuery({
    queryKey: ['room', 'overview', roomId],
    queryFn: () => import('@features/rooms/api').then((m) => m.roomService.getOverview(roomId)),
  });

  const overview = overviewRaw?.data ?? overviewRaw;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
        <div className="w-full bg-card rounded-t-2xl border-t border-border p-8 flex flex-col items-center justify-center min-h-[30vh]" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="w-8 h-8 animate-spin text-accent mb-2" />
          <p className="text-sm text-muted-foreground">Loading room overview...</p>
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
        <div className="w-full bg-card rounded-t-2xl border-t border-border p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-foreground font-semibold">Failed to load room overview</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-secondary rounded-xl text-xs font-semibold">Close</button>
        </div>
      </div>
    );
  }

  const room = overview.room ?? {};
  const tenants = Array.isArray(overview.tenants) ? overview.tenants : [];
  const payments = Array.isArray(overview.payments) ? overview.payments : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-card rounded-t-2xl border-t border-border max-h-[85dvh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-bold text-foreground text-sm">Room {room.room_no || 'Overview'}</h2>
            <p className="text-[10px] text-muted-foreground">
              Floor {room.floor ?? 0} · {room.occupied ?? 0}/{room.capacity ?? 1} Beds Occupied
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground active:scale-90 hover:bg-secondary rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Rent & Dues Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-medium">Monthly Rent</span>
              <span className="text-sm font-bold text-foreground">{fmt(room.base_rent ?? room.monthly_rent ?? 0)}</span>
            </div>
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-medium">Pending Room Dues</span>
              <span className={`text-sm font-bold ${Number(overview.pending_dues ?? 0) > 0 ? 'text-destructive' : 'text-accent'}`}>
                {fmt(overview.pending_dues ?? 0)}
              </span>
            </div>
          </div>

          {/* Tenants Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Residents</h3>
              {tenants.length < (room.capacity ?? 1) && (
                <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                  {Number(room.capacity ?? 1) - tenants.length} Bed(s) Available
                </span>
              )}
            </div>

            {tenants.length === 0 ? (
              <div className="p-6 border border-dashed border-border rounded-xl text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="text-xs text-muted-foreground font-medium">No tenants currently allocated to this room</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tenants.map((t: any) => (
                  <div key={t.tenant_id} className="p-3 rounded-xl border border-border bg-secondary/10 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                          {t.name ? t.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'T'}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-foreground">{t.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{t.phone || 'No phone'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Rent: <span className="font-semibold text-foreground">{fmt(t.rent ?? room.base_rent ?? 0)}/mo</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          t.payment_status === 'PAID' ? 'bg-[#10B981]/10 text-[#047857]' : 'bg-[#F59E0B]/10 text-[#B45309]'
                        }`}>
                          {t.payment_status || 'PENDING'}
                        </span>
                        {t.pending_dues > 0 && (
                          <p className="text-[10px] font-semibold text-destructive mt-1">Dues: {fmt(t.pending_dues)}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Joined: {new Date(t.joined_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <button
                        type="button"
                        onClick={() => onTransferTenant(t.tenant_id)}
                        className="flex items-center gap-1 text-accent font-semibold hover:underline"
                      >
                        <Repeat2 className="w-3 h-3" /> Shift / Re-allocate Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments Section */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Room Payments</h3>
              <div className="bg-secondary/10 border border-border rounded-xl divide-y divide-border/40">
                {payments.slice(0, 3).map((p: any, idx: number) => (
                  <div key={idx} className="p-2 flex items-center justify-between text-[10px]">
                    <div>
                      <p className="font-medium text-foreground">{p.tenant_name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="font-semibold text-[#047857]">{fmt(p.amount_paid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit / Quick actions footer */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditRoom(room);
              }}
              className="flex-1 py-2 rounded-xl border border-border font-semibold text-xs text-foreground bg-card hover:bg-secondary/40 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit Room Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────────
function RoomsTab({ hostelId }: { hostelId: string }) {
  const qc = useQueryClient();
  const [assignTenantRoomId, setAssignTenantRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm]               = useState<{ room: Record<string, unknown> | null; floorId?: string } | null>(null);
  const [showAddFloor, setShowAddFloor]       = useState(false);
  const [floorMenu, setFloorMenu]             = useState<{ id: string; name: string } | null>(null);
  const [renameFloor, setRenameFloor]         = useState<{ id: string; name: string } | null>(null);
  const [collapsed, setCollapsed]             = useState<Set<string>>(new Set());
  const [roomError, setRoomError]             = useState<string | null>(null);

  const [selectedRoomOverviewId, setSelectedRoomOverviewId] = useState<string | null>(null);
  const [selectedTransferTenantId, setSelectedTransferTenantId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.rooms.list(hostelId) });
    qc.invalidateQueries({ queryKey: ['floors', hostelId] });
  };

  const { data: roomsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.rooms.list(hostelId),
    queryFn: () => import('@features/rooms/api').then((m) => m.roomService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors', hostelId],
    queryFn: () => import('@features/rooms/api').then((m) => m.floorService.getAll(hostelId)),
    staleTime: 2 * 60 * 1000,
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      import('@features/rooms/api').then((m) => m.roomService.create(hostelId, data)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Failed to create room'),
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      import('@features/rooms/api').then((m) => m.roomService.update(id, data)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Failed to update room'),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string) =>
      import('@features/rooms/api').then((m) => m.roomService.delete(id)),
    onSuccess: () => { invalidate(); setRoomForm(null); },
    onError: (e: any) => setRoomError(e?.response?.data?.error?.message ?? 'Cannot delete room with active tenants'),
  });

  const addFloorMutation = useMutation({
    mutationFn: async (name: string) =>
      import('@features/rooms/api').then((m) => m.floorService.create(hostelId, { name })),
    onSuccess: () => { invalidate(); setShowAddFloor(false); },
  });

  const renameFloorMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      import('@features/rooms/api').then((m) => m.floorService.update(id, { name })),
    onSuccess: () => { invalidate(); setRenameFloor(null); },
  });

  const deleteFloorMutation = useMutation({
    mutationFn: async (id: string) =>
      import('@features/rooms/api').then((m) => m.floorService.delete(id)),
    onSuccess: () => { invalidate(); setFloorMenu(null); },
    onError: (e: any) => {
      setFloorMenu(null);
      setRoomError(e?.response?.data?.error?.message ?? 'Cannot delete floor with rooms');
    },
  });

  if (isLoading) return <TabSkeleton />;
  if (isError)   return <TabError onRetry={refetch} />;

  const rooms: Record<string, unknown>[] = Array.isArray(roomsData) ? roomsData : [];
  const floors: Record<string, unknown>[] = Array.isArray(floorsData) ? floorsData : [];

  const floorGroups: Map<string, { id: string; name: string; sort: number; rooms: Record<string, unknown>[] }> = new Map();
  rooms.forEach((room) => {
    const fid   = String(room.floor_id ?? '__none');
    const fname = String(room.floor_name ?? (room.floor_id ? 'Floor' : 'Unassigned'));
    const fsort = Number(room.floor_sort_order ?? 999);
    if (!floorGroups.has(fid)) floorGroups.set(fid, { id: fid, name: fname, sort: fsort, rooms: [] });
    floorGroups.get(fid)!.rooms.push(room);
  });
  floors.forEach((f) => {
    const fid = String(f.id);
    if (!floorGroups.has(fid))
      floorGroups.set(fid, { id: fid, name: String(f.name), sort: Number(f.sort_order ?? 0), rooms: [] });
  });

  const groups     = Array.from(floorGroups.values()).sort((a, b) => a.sort - b.sort);
  const totalBeds  = rooms.reduce((s, r) => s + Number(r.capacity ?? 0), 0);
  const totalOccupied = rooms.reduce((s, r) => s + Number(r.occupied_count ?? 0), 0);
  const totalVacant   = rooms.filter((r) => String(r.status) === 'vacant').length;

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const roomSaving   = createRoomMutation.isPending || updateRoomMutation.isPending;
  const roomDeleting = deleteRoomMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Error toast */}
      {roomError && (
        <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <span className="text-xs text-destructive">{roomError}</span>
          <button onClick={() => setRoomError(null)} className="text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-3">
          <div className="text-base font-semibold text-[#10B981]">{totalOccupied}/{totalBeds}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Beds occupied</div>
        </div>
        <div className={`rounded-xl p-3 ${ totalVacant > 0 ? 'bg-[#3B82F6]/8 border border-[#3B82F6]/20' : 'bg-card border border-border' }`}>
          <div className={`text-base font-semibold ${ totalVacant > 0 ? 'text-[#3B82F6]' : 'text-foreground' }`}>{totalVacant}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Vacant rooms</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-base font-semibold text-foreground">{groups.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Floors</div>
        </div>
      </div>

      {/* Floor groups */}
      {groups.length === 0 && rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
            <BedDouble className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No rooms yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a floor then add rooms to it</p>
          </div>
        </div>
      ) : groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        const groupVacant = group.rooms.filter((r) => String(r.status) === 'vacant').length;
        const isReal      = group.id !== '__none';
        return (
          <div key={group.id}>
            {/* Floor header row */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleCollapse(group.id)}
                className="flex-1 flex items-center gap-2 py-2 touch-manipulation min-w-0"
              >
                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">{group.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{group.rooms.length} rooms</span>
                {groupVacant > 0 && (
                  <span className="text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] px-1.5 py-0.5 rounded-full font-medium shrink-0">{groupVacant} vacant</span>
                )}
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />}
              </button>
              {isReal && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFloorMenu({ id: group.id, name: group.name }); }}
                  className="p-1.5 text-muted-foreground active:scale-90 shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div className="space-y-2">
                {group.rooms.map((room) => {
                  const isOccupied = String(room.status) === 'occupied';
                  const occupied   = Number(room.occupied_count ?? 0);
                  const capacity   = Number(room.capacity ?? 0);
                  const hasVacantBed = occupied < capacity;
                  const roomDues = Number(room.outstanding_dues ?? room.due_amount ?? room.pending_dues ?? 0);
                  const vacantBeds = Math.max(0, capacity - occupied);
                  const tenants = Array.isArray(room.tenants) ? (room.tenants as Record<string, unknown>[]) : [];
                  const tenantNames = tenants
                    .map((tenant) => String(tenant.name ?? '').trim())
                    .filter(Boolean);
                  return (
                    <div
                      key={String(room.id)}
                      className={`bg-card border rounded-xl p-3.5 min-w-0 ${
                        roomDues > 0 ? 'border-[#F59E0B]/50'
                        : !isOccupied ? 'border-[#3B82F6]/15'
                        : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 cursor-pointer hover:opacity-80" onClick={() => setSelectedRoomOverviewId(String(room.id))}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{String(room.room_no)}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              roomDues > 0          ? 'bg-[#F59E0B]/10 text-[#B45309]'
                              : occupied === 0      ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              : occupied < capacity ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#10B981]/10 text-[#10B981]'
                            }`}>
                              {occupied}/{capacity} beds{roomDues > 0 ? ' · dues pending' : ''}
                            </span>
                          </div>
                          <div className="mt-2">
                            <BedOccupancyBlocks occupied={occupied} capacity={capacity} hasDues={roomDues > 0} />
                          </div>
                          {vacantBeds > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-1">{vacantBeds} vacant bed{vacantBeds === 1 ? '' : 's'}</div>
                          )}
                          {isOccupied && tenantNames.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {tenants.slice(0, 3).map((tenant, index) => (
                                <div key={String(tenant.tenant_id ?? tenant.allocation_id ?? index)} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground truncate">{String(tenant.name ?? 'Tenant')}</span>
                                  <span className="font-semibold text-foreground shrink-0">{fmt(tenant.monthly_rent ?? room.base_rent ?? 0)}/mo</span>
                                </div>
                              ))}
                              {tenants.length > 3 && (
                                <div className="text-[11px] text-muted-foreground">+{tenants.length - 3} more residents</div>
                              )}
                            </div>
                          )}
                          {!isOccupied && (
                            <div className="text-xs text-muted-foreground mt-0.5">{fmt(room.monthly_rent ?? room.base_rent ?? 0)}/mo base rent</div>
                          )}
                          {room.notes && (
                            <div className="flex items-start gap-1 mt-1.5">
                              <FileText className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span className="text-[11px] text-muted-foreground leading-snug">{String(room.notes)}</span>
                            </div>
                          )}
                          <WifiCell
                            wifiName={room.wifi_name ? String(room.wifi_name) : null}
                            wifiPassword={room.wifi_password ? String(room.wifi_password) : null}
                          />
                        </div>
                        <button
                          onClick={() => setRoomForm({ room })}
                          className="p-1.5 text-muted-foreground active:scale-90 shrink-0 mt-0.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {hasVacantBed && (
                        <button
                          onClick={() => setAssignTenantRoomId(String(room.id))}
                          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 bg-card border border-border rounded-lg text-xs font-medium text-accent active:scale-95 transition-transform touch-manipulation"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {occupied === 0 ? 'Assign Tenant' : `Assign to ${vacantBeds} vacant bed${vacantBeds === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Room to this floor */}
                <button
                  onClick={() => setRoomForm({ room: null, floorId: isReal ? group.id : '' })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground active:text-foreground transition-colors touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Room
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Floor */}
      <button
        onClick={() => setShowAddFloor(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground active:text-foreground active:border-foreground transition-colors touch-manipulation"
      >
        <Plus className="w-3.5 h-3.5" /> Add Floor
      </button>

      {/* Modals */}
      {assignTenantRoomId && (
        <AddTenantModal
          hostelId={hostelId}
          preselectedRoomId={assignTenantRoomId}
          onClose={() => setAssignTenantRoomId(null)}
        />
      )}

      {showAddFloor && (
        <FloorNameModal
          title="Add Floor"
          submitLabel="Add Floor"
          onClose={() => setShowAddFloor(false)}
          onSubmit={(name) => addFloorMutation.mutate(name)}
          busy={addFloorMutation.isPending}
        />
      )}

      {renameFloor && (
        <FloorNameModal
          title="Rename Floor"
          initialName={renameFloor.name}
          submitLabel="Save"
          onClose={() => setRenameFloor(null)}
          onSubmit={(name) => renameFloorMutation.mutate({ id: renameFloor.id, name })}
          busy={renameFloorMutation.isPending}
        />
      )}

      {floorMenu && (
        <FloorActionsSheet
          floor={floorMenu}
          onClose={() => setFloorMenu(null)}
          onRename={() => setRenameFloor(floorMenu)}
          onDelete={() => deleteFloorMutation.mutate(floorMenu.id)}
          deleting={deleteFloorMutation.isPending}
        />
      )}

      {roomForm !== null && (
        <RoomFormModal
          room={roomForm.room}
          defaultFloorId={roomForm.floorId}
          floors={floors}
          onClose={() => { setRoomForm(null); setRoomError(null); }}
          onSave={(data) => {
            setRoomError(null);
            if (roomForm.room) {
              updateRoomMutation.mutate({ id: String(roomForm.room.id), data });
            } else {
              createRoomMutation.mutate(data);
            }
          }}
          onDelete={roomForm.room ? () => deleteRoomMutation.mutate(String(roomForm.room!.id)) : undefined}
          saving={roomSaving}
          deleting={roomDeleting}
        />
      )}

      {selectedRoomOverviewId && (
        <RoomOverviewModal
          hostelId={hostelId}
          roomId={selectedRoomOverviewId}
          onClose={() => setSelectedRoomOverviewId(null)}
          onEditRoom={(room) => setRoomForm({ room })}
          onTransferTenant={(tenantId) => setSelectedTransferTenantId(tenantId)}
        />
      )}

      {selectedTransferTenantId && (
        <TransferRoomSheet
          hostelId={hostelId}
          tenantId={selectedTransferTenantId}
          onClose={() => setSelectedTransferTenantId(null)}
          onSuccess={() => {
            setSelectedTransferTenantId(null);
            invalidate();
            if (selectedRoomOverviewId) {
              qc.invalidateQueries({ queryKey: ['room', 'overview', selectedRoomOverviewId] });
            }
          }}
        />
      )}
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

  return (
    <>
      <FinancialControlCenter
        hostelId={hostelId}
        onRecordPayment={() => setShowRecordPayment(true)}
      />
      {showRecordPayment && (
        <RecordPaymentModal hostelId={hostelId} onClose={() => setShowRecordPayment(false)} />
      )}
    </>
  );
}

function ExpensesTab({ hostelId }: { hostelId: string }) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState('month');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const params = useMemo(
    () => ({
      range,
      status,
      sort,
      search,
      categories: selectedCategories.join(','),
      limit: 40,
    }),
    [range, search, selectedCategories, sort, status],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.list(hostelId), params],
    queryFn: () =>
      import('@features/expenses/api').then((m) => m.expenseService.getAll(hostelId, params)),
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      import('@features/expenses/api').then((m) => m.expenseService.create(hostelId, body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      setShowAddExpense(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      import('@features/expenses/api').then((m) => m.expenseService.update(id, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => import('@features/expenses/api').then((m) => m.expenseService.delete(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) }),
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const payload = (data || {}) as Record<string, any>;
  const expenses: Record<string, any>[] = Array.isArray(payload.expenses) ? payload.expenses : [];
  const kpis = payload.kpis || {};
  const categories = Array.isArray(payload.category_breakdown) ? payload.category_breakdown : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const monthlyTrend = Array.isArray(payload.monthly_trend) ? payload.monthly_trend : [];
  const occupancy = payload.occupancy_impact || {};
  const allCategories: string[] = payload.meta?.categories || EXPENSE_CATEGORIES;
  const maxCategory = Math.max(...categories.map((c: any) => Number(c.amount || 0)), 1);
  const maxTrend = Math.max(
    ...monthlyTrend.map((m: any) => Math.max(Number(m.revenue || 0), Number(m.expenses || 0), Number(m.profit || 0))),
    1,
  );

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  };

  return (
    <div className="relative space-y-5 pb-24">
      <div className="sticky top-[92px] z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <ExpenseKpi
            label="This Month Expenses"
            value={fmt(kpis.this_month_expenses)}
            sub={`${Math.abs(Number(kpis.expense_growth_rate || 0)).toFixed(0)}% ${Number(kpis.expense_growth_rate || 0) >= 0 ? 'vs last month' : 'lower'}`}
            state={Number(kpis.expense_growth_rate || 0) > 20 ? 'dangerous' : Number(kpis.expense_growth_rate || 0) > 5 ? 'warning' : 'healthy'}
            trend={Number(kpis.expense_growth_rate || 0)}
          />
          <ExpenseKpi
            label="Net Profit"
            value={fmt(kpis.net_profit)}
            sub={`${Number(kpis.profit_margin || 0).toFixed(0)}% margin`}
            state={String(kpis.health || 'healthy')}
          />
          <ExpenseKpi
            label="Expense / Tenant"
            value={fmt(kpis.expense_per_tenant)}
            sub="operational load"
            state={Number(kpis.expense_per_tenant || 0) > 10000 ? 'warning' : 'healthy'}
          />
          <ExpenseKpi
            label="Expense Ratio"
            value={`${Number(kpis.expense_revenue_ratio || 0).toFixed(0)}%`}
            sub="of revenue consumed"
            state={String(kpis.expense_ratio_health || 'healthy')}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddExpense(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground active:scale-[0.99] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Expense Intelligence"
          sub="Where money is moving and what needs attention"
          actionLabel="Add expense"
          onAction={() => setShowAddExpense(true)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Category Breakdown</h3>
              <span className="text-[10px] text-muted-foreground">This month</span>
            </div>
            {categories.length === 0 ? (
              <EmptyMini
                text="Add your first expense to reveal category leakage."
                actionLabel="Add expense"
                onAction={() => setShowAddExpense(true)}
              />
            ) : (
              <div className="space-y-3">
                {categories.slice(0, 8).map((cat: any) => (
                  <div key={String(cat.category)}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <span className="font-medium text-foreground">{cat.category}</span>
                      <span className="text-muted-foreground">
                        {fmt(cat.amount)} · {Number(cat.percentage || 0).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${categoryTone(cat.category).bar}`}
                        style={{ width: `${Math.max(4, (Number(cat.amount || 0) / maxCategory) * 100)}%` }}
                      />
                    </div>
                    {cat.anomaly && (
                      <div className="mt-1 text-[10px] font-medium text-warning">{cat.anomaly}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Health Insights</h3>
            </div>
            <div className="space-y-2">
              {insights.map((insight: any, i: number) => (
                <div key={`${insight.title}-${i}`} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${severityDot(insight.severity)}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue · Expense · Profit</h3>
            <div className="space-y-3">
              {monthlyTrend.map((m: any) => (
                <div key={String(m.month)} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{String(m.month)}</span>
                    <span>{fmt(m.profit)} profit</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 h-8 items-end">
                    <TrendBar value={Number(m.revenue || 0)} max={maxTrend} className="bg-success" />
                    <TrendBar value={Number(m.expenses || 0)} max={maxTrend} className="bg-destructive" />
                    <TrendBar value={Math.max(0, Number(m.profit || 0))} max={maxTrend} className="bg-accent" />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-success" />Revenue</span>
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-destructive" />Expenses</span>
                <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-accent" />Profit</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Occupancy Impact</h3>
            <div className="grid grid-cols-2 gap-3">
              <ImpactMetric label="Occupancy" value={`${Number(occupancy.occupancy_rate || 0).toFixed(0)}%`} />
              <ImpactMetric label="Expense / Bed" value={fmt(occupancy.expense_per_occupied_bed)} />
              <ImpactMetric label="Vacancy Loss" value={fmt(occupancy.vacancy_loss_estimate)} />
              <ImpactMetric label="Fixed Cost" value={`${Number(occupancy.fixed_cost_pressure || 0).toFixed(0)}%`} />
            </div>
            <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-foreground">
              {occupancy.message || 'Occupancy and cost pressure will appear as snapshots build.'}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Expense Ledger"
          sub={`${payload.total || expenses.length} records`}
          actionLabel="Add expense"
          onAction={() => setShowAddExpense(true)}
        />
        <div className="sticky top-[260px] z-[9] -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-y border-border space-y-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`shrink-0 px-3 py-2 rounded-full text-xs font-semibold border ${
                  range === value ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="shrink-0 px-3 py-2 rounded-full text-xs border border-border bg-card">
              <option value="recent">Recent</option>
              <option value="highest">Highest Amount</option>
              <option value="oldest">Oldest</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, vendor, notes"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {allCategories.slice(0, 12).map((category) => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${
                  selectedCategories.includes(category)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {expenses.length === 0 ? (
          <ExpenseEmptyState onAdd={() => setShowAddExpense(true)} />
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <ExpenseCard
                key={String(expense.id)}
                expense={expense}
                onDuplicate={() => setShowAddExpense(true)}
                onMarkPending={() => updateMutation.mutate({ id: String(expense.id), body: { status: 'pending' } })}
                onDelete={() => deleteMutation.mutate(String(expense.id))}
              />
            ))}
          </div>
        )}
      </section>

      {showAddExpense && (
        <AddExpenseModal
          categories={allCategories}
          loading={createMutation.isPending}
          onClose={() => setShowAddExpense(false)}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      )}
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  'Food',
  'Electricity',
  'Water',
  'Internet',
  'Staff Salary',
  'Maintenance',
  'Repairs',
  'Cleaning',
  'Security',
  'Furniture',
  'Kitchen',
  'Marketing',
  'Transport',
  'Miscellaneous',
];

function SectionTitle({
  title,
  sub,
  actionLabel,
  onAction,
}: {
  title: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ExpenseKpi({ label, value, sub, state, trend }: { label: string; value: string; sub: string; state: string; trend?: number }) {
  const color = state === 'dangerous' ? 'text-destructive' : state === 'warning' ? 'text-warning' : 'text-success';
  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{label}</p>
        {trend !== undefined ? (
          trend >= 0 ? <TrendingUp className={`w-3.5 h-3.5 ${color}`} /> : <TrendingDown className="w-3.5 h-3.5 text-success" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${state === 'dangerous' ? 'bg-destructive' : state === 'warning' ? 'bg-warning' : 'bg-success'}`} />
        )}
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function categoryTone(category: string) {
  const tones: Record<string, { chip: string; bar: string }> = {
    Food: { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
    Electricity: { chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
    Water: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    Maintenance: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  };
  return tones[category] || { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
}

function severityDot(severity: string) {
  if (severity === 'dangerous') return 'bg-destructive';
  if (severity === 'warning') return 'bg-warning';
  return 'bg-success';
}

function TrendBar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-8 flex items-end rounded bg-muted/40 overflow-hidden">
      <div className={`w-full rounded-t ${className}`} style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
    </div>
  );
}

function ImpactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyMini({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p>{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ExpenseEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
        <Zap className="w-6 h-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-foreground">Start tracking hostel operations</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Track electricity, food, maintenance and staff costs to understand profitability.
      </p>
      <div className="mt-4 grid gap-2 text-left text-xs text-muted-foreground">
        <div className="rounded-lg bg-background border border-border p-3">Food cost vs revenue insight</div>
        <div className="rounded-lg bg-background border border-border p-3">Expense per occupied bed</div>
        <div className="rounded-lg bg-background border border-border p-3">Profit margin warnings</div>
      </div>
      <button onClick={onAdd} className="mt-5 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">
        Add First Expense
      </button>
    </div>
  );
}

function ExpenseCard({
  expense,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{String(expense.title || 'Expense')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${tone.chip}`}>{String(expense.category || 'Misc')}</span>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {expense.date ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No date'}
            </span>
            {expense.is_recurring && (
              <span className="text-[10px] text-accent inline-flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                Recurring
              </span>
            )}
          </div>
          {(expense.notes || expense.vendor_name || expense.hostel) && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {[expense.vendor_name, expense.notes, expense.hostel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-foreground">{fmt(expense.amount)}</p>
          <p className={`mt-1 text-[10px] font-semibold ${expense.status === 'paid' ? 'text-success' : expense.status === 'cancelled' ? 'text-destructive' : 'text-warning'}`}>
            {String(expense.status || 'paid').toUpperCase()}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={onDuplicate} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Duplicate</button>
        <button onClick={onMarkPending} className="rounded-lg border border-border py-2 text-[10px] font-semibold text-muted-foreground">Mark Pending</button>
        <button onClick={onDelete} className="rounded-lg border border-destructive/20 py-2 text-[10px] font-semibold text-destructive">Delete</button>
      </div>
    </div>
  );
}

function AddExpenseModal({
  categories,
  loading,
  onClose,
  onSubmit,
}: {
  categories: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Miscellaneous',
    date: new Date().toISOString().slice(0, 10),
    status: 'paid',
    notes: '',
    payment_method: '',
    vendor_name: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';

  const submit = () => {
    if (!form.title.trim() || !Number(form.amount) || !form.category || !form.date) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      category: form.category,
      notes: form.notes.trim() || undefined,
      vendor_name: form.vendor_name.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      expense_type: ['Internet', 'Security', 'Staff Salary', 'Salary'].includes(form.category) ? 'FIXED' : 'VARIABLE',
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border p-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Add Expense</h3>
            <p className="text-xs text-muted-foreground">Fast entry for daily operations</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category }));
            }}
            placeholder="Title, e.g. EB Bill"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          {suggestion && (
            <button
              onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
              className="text-[10px] font-semibold text-accent"
            >
              Suggested category: {suggestion}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Amount"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              placeholder="Payment method"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor name"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            rows={3}
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none"
          />
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-muted/40">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {receiptFile ? receiptFile.name : 'Attach receipt image'}
              </p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP under 4MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <span className="text-sm font-medium text-foreground">Recurring expense</span>
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            />
          </label>
          {form.is_recurring && (
            <select value={form.recurring_frequency} onChange={(e) => setForm((f) => ({ ...f, recurring_frequency: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>

        <button
          onClick={submit}
          disabled={loading || !form.title.trim() || !Number(form.amount)}
          className="mt-5 w-full py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </div>
    </div>
  );
}

function suggestExpenseCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal)/.test(text)) return 'Food';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter)/.test(text)) return 'Repairs';
  if (/(clean|housekeep)/.test(text)) return 'Cleaning';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(water|tanker)/.test(text)) return 'Water';
  return 'Miscellaneous';
}

function MoveOutsTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.moveOut.list(hostelId),
    queryFn: () => moveOutService.listRequests(hostelId, { limit: 20 }),
    enabled: Boolean(hostelId),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const moveouts: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.requests)
    ? ((data as Record<string, unknown>).requests as Record<string, unknown>[])
    : [];

  if (moveouts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No move-out requests yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          Tenant move-out requests, inspections, settlement approvals, and exit payments will appear here as soon as the workflow starts.
        </p>
        <Link
          to={`/hostels/${hostelId}/move-outs`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground active:scale-95"
        >
          Open move-out workflow
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Move-out workflow</h3>
          <p className="text-xs text-muted-foreground">Live requests from tenant exit operations</p>
        </div>
        <Link to={`/hostels/${hostelId}/move-outs`} className="text-xs font-semibold text-accent">
          Manage
        </Link>
      </div>
      {moveouts.map((moveout, i) => {
        const tenant = moveout.tenant as Record<string, unknown> | undefined;
        const profile = (tenant?.profiles ?? tenant?.profile ?? moveout.profile) as Record<string, unknown> | undefined;
        const allocation = Array.isArray(tenant?.room_allocations)
          ? (tenant.room_allocations[0] as Record<string, unknown> | undefined)
          : undefined;
        const room = allocation?.room as Record<string, unknown> | undefined;
        const settlement = (moveout.settlement_preview ?? moveout.settlement ?? {}) as Record<string, unknown>;
        const status = String(moveout.status ?? 'REQUESTED');
        const plannedExit = String(moveout.planned_exit_date ?? moveout.move_out_date ?? moveout.updated_at ?? '');
        const tenantName = String(moveout.tenant_name ?? profile?.name ?? moveout.name ?? 'Tenant');
        const roomNo = String(room?.room_no ?? moveout.room_no ?? moveout.room_number ?? 'Unassigned');
        const netAmount = Number(settlement.net_settlement_amount ?? settlement.net_amount ?? 0);
        const direction = String(settlement.settlement_direction ?? settlement.direction ?? '');

        return (
          <Link
            key={String(moveout.id ?? i)}
            to={`/hostels/${hostelId}/move-outs`}
            className="block bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{tenantName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" />
                    Room {roomNo}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {plannedExit ? new Date(plannedExit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Exit date pending'}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${moveOutStatusClass(status)}`}>
                {status.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                {direction === 'OWNER_OWES_TENANT'
                  ? 'Refund pending'
                  : direction === 'TENANT_OWES_OWNER'
                  ? 'Tenant payment pending'
                  : 'Settlement in progress'}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <IndianRupee className="h-3.5 w-3.5" />
                {Math.abs(netAmount).toLocaleString('en-IN')}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function moveOutStatusClass(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'PAYMENT_PENDING' || status === 'SETTLEMENT_APPROVED') return 'bg-amber-500/10 text-amber-700';
  if (status === 'DISPUTED') return 'bg-rose-500/10 text-rose-700';
  if (status === 'INSPECTION_DONE') return 'bg-sky-500/10 text-sky-700';
  return 'bg-accent/10 text-accent';
}
