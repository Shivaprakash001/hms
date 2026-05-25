import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, BedDouble, Receipt, AlertCircle, Plus, CreditCard, Phone, TrendingUp, Activity, AlertTriangle, BellRing, ClipboardCheck, Flame, Home, IndianRupee, Megaphone, UserPlus } from 'lucide-react';
import { dashboardService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { type HostelDetailTab as Tab } from '../types';
import { fmt } from '../shared/format';
import { TabSkeleton } from '../shared/TabStates';

export function OverviewTab({ hostelId }: { hostelId: string }) {
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: queryKeys.dashboard.stats(hostelId),
    queryFn: () => dashboardService.getStats(hostelId),
    enabled: !!hostelId,
    staleTime: 2 * 60 * 1000,
  });
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

