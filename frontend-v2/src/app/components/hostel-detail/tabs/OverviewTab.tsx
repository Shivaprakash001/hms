import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  Plus,
  X,
  UserPlus,
  Receipt,
  CreditCard,
  Megaphone,
  Home,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { dashboardService } from '@features/dashboard/api';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { type HostelDetailTab as Tab } from '../types';
import { fmt, fmtExact } from '../shared/format';
import { TabSkeleton } from '../shared/TabStates';
import { toast } from 'sonner';

export function OverviewTab({ hostelId }: { hostelId: string }) {
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);

  // Fetch Stats Shell
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboard.statsShell(hostelId),
    queryFn: () => dashboardService.getStatsShell(hostelId),
    enabled: !!hostelId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch Stats Activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: queryKeys.dashboard.statsActivity(hostelId),
    queryFn: () => dashboardService.getStatsActivity(hostelId),
    enabled: !!hostelId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch Move-out data
  const { data: requestsData } = useQuery({
    queryKey: queryKeys.tenants.moveOut(hostelId, 'all-requests'),
    queryFn: () => moveOutService.listRequests(hostelId, {}),
    enabled: !!hostelId,
  });

  if (statsLoading) return <TabSkeleton />;

  const s = (stats?.data ?? stats ?? {}) as any;
  const intel = s.intelligence ?? {};
  const hostel = s.hostel ?? {};

  // Occupancy details
  const activeTenants = Number(s.active_tenants ?? 0);
  const occupiedBeds = Number(s.occupied_beds ?? activeTenants);
  const unassignedActiveTenants = Number(s.unassigned_active_tenants ?? 0);
  const totalCapacity = Number(s.total_capacity ?? 0);
  const vacantBeds = Number(s.vacant_beds ?? Math.max(totalCapacity - occupiedBeds, 0));
  
  const roomUtilization = intel.occupancy?.room_utilization ?? [];
  const floorOccupancy = intel.occupancy?.floor_occupancy ?? [];

  // Dues & collections details
  const pendingTotal = Number(s.pending_dues ?? intel.dues?.summary?.total_dues ?? 0);
  const overdueTotal = Number(s.overdue_amount ?? intel.dues?.summary?.overdue_dues ?? 0);
  const collectionRate = Number(s.collection_rate ?? intel.revenue?.collection_efficiency?.collection_rate ?? 0);
  const overdueTenantsCount = Number(s.overdue_count ?? intel.dues?.overdue_tenants ?? 0);

  // Admissions pipeline details
  const tenantMovement = intel.tenant_movement ?? {};
  const pendingInvites = Number(tenantMovement.pending_onboarding ?? s.pending_invites ?? 0);
  const activationPending = Number(tenantMovement.inactive_invitations ?? s.inactive_invites ?? 0);

  // Move outs
  const moveOutRequests = Number(tenantMovement.move_out_requests ?? s.move_out_open ?? 0);

  const requestsList = Array.isArray(requestsData) 
    ? requestsData 
    : (requestsData as any)?.requests ?? [];

  const moveOutReqsCount = requestsList.filter(
    (r: any) => [
      'REQUESTED',
      'SETTLEMENT_PENDING',
      'SETTLEMENT_APPROVED',
      'PHYSICALLY_VACATED',
      'SETTLEMENT_PENDING_PAYMENT',
      'APPROVED',
      'VACATED',
    ].includes(r.status)
  ).length;

  const upcomingVacanciesCount = requestsList.filter(
    (r: any) => ['REQUESTED', 'SETTLEMENT_PENDING', 'SETTLEMENT_APPROVED', 'APPROVED'].includes(r.status)
  ).length;

  const pendingRefundsCount = requestsList.filter(
    (r: any) => r.settlement?.settlement_direction === 'OWNER_OWES_TENANT' && r.status !== 'COMPLETED'
  ).length;

  // Recent activity timeline
  const activity = activityData?.recent_activity ?? [];

  const action = (tab: Tab) => {
    if (tab === 'financials') {
      navigate(`/billing?hostelId=${hostelId}`);
    } else if (tab === 'expenses') {
      navigate(`/billing?hostelId=${hostelId}&action=expense`);
    } else {
      navigate(`/hostels/${hostelId}/${tab}`);
    }
  };

  // 1. Today's Focus Card
  const focusItems: string[] = [];
  if (overdueTotal > 0) {
    focusItems.push(`Collect ${fmtExact(overdueTotal)} from ${overdueTenantsCount} tenant${overdueTenantsCount !== 1 ? 's' : ''}`);
  }
  if (vacantBeds > 0) {
    focusItems.push(`Fill ${vacantBeds} vacant bed${vacantBeds !== 1 ? 's' : ''}`);
  }
  if (unassignedActiveTenants > 0) {
    focusItems.unshift(`Assign rooms to ${unassignedActiveTenants} active tenant${unassignedActiveTenants !== 1 ? 's' : ''}`);
  }
  if (moveOutRequests > 0) {
    focusItems.push(`Process ${moveOutRequests} move-out request${moveOutRequests !== 1 ? 's' : ''}`);
  }
  if (pendingInvites > 0) {
    focusItems.push(`Onboard ${pendingInvites} pending invite${pendingInvites !== 1 ? 's' : ''}`);
  }

  // 2. Today's Priorities Sorted by business impact
  const priorityItems = [
    { key: 'overdue', condition: overdueTotal > 0, label: `${fmtExact(overdueTotal)} Overdue`, icon: '💰' },
    { key: 'moveout', condition: moveOutRequests > 0, label: `${moveOutRequests} Move-out Request${moveOutRequests !== 1 ? 's' : ''}`, icon: '🚪' },
    { key: 'vacant', condition: vacantBeds > 0, label: `${vacantBeds} Vacant Bed${vacantBeds !== 1 ? 's' : ''}`, icon: '🛏' },
    { key: 'invites', condition: pendingInvites > 0, label: `${pendingInvites} Pending Invite${pendingInvites !== 1 ? 's' : ''}`, icon: '📨' }
  ].filter(item => item.condition);

  // 3. Occupancy Risk calculation
  const occupancyRisk = vacantBeds >= 5 ? 'High' : vacantBeds > 0 ? 'Medium' : 'Low';
  const occupancyRiskColor = occupancyRisk === 'High' 
    ? 'text-destructive bg-destructive/10 border-destructive/20' 
    : occupancyRisk === 'Medium' 
    ? 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200' 
    : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200';

  // 4. Timeline relative grouping helpers
  const getRelativeDayLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };

  const formatTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Group activity timeline
  const groupedActivity: Record<string, any[]> = {};
  activity.forEach((item: any) => {
    const label = getRelativeDayLabel(item.date);
    if (!groupedActivity[label]) {
      groupedActivity[label] = [];
    }
    groupedActivity[label].push(item);
  });

  const triggerTakeAction = () => {
    setFabOpen(true);
    toast.info("Select a quick action below to start managing today's focus.");
  };

  return (
    <div className="space-y-6 pb-24">
      {/* TODAY'S FOCUS (Primary Card) */}
      <section className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800/60 border border-indigo-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-indigo-600" /> Today's Focus
        </h3>
        {focusItems.length > 0 ? (
          <div className="mt-3 space-y-2">
            {focusItems.map((item, idx) => (
              <p key={idx} className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-start gap-2">
                <span className="text-indigo-500 mt-1 select-none">•</span>
                <span>{item}</span>
              </p>
            ))}
            <div className="pt-3">
              <button
                onClick={triggerTakeAction}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-bold rounded-xl text-xs shadow-sm shadow-indigo-200 dark:shadow-none"
              >
                Take Action <ArrowRight className="w-3.5 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              All clear! Your hostel operations are running smoothly.
            </p>
          </div>
        )}
      </section>

      {/* TODAY'S PRIORITIES */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Today's Priorities</h3>
        {priorityItems.length > 0 ? (
          <div className="divide-y divide-border">
            {priorityItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-lg shrink-0 select-none">{item.icon}</span>
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">All operations healthy</span>
          </div>
        )}
      </section>

      {/* OPERATIONS SNAPSHOT */}
      <section className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Beds</div>
            <div className="text-base font-bold text-foreground">{occupiedBeds} / {totalCapacity}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Due</div>
            <div className="text-base font-bold text-foreground">{fmtExact(pendingTotal)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Cash</div>
            <div className="text-base font-bold text-foreground">{fmt(s.revenue)}</div>
          </div>
        </div>
      </section>

      {/* OCCUPANCY */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Occupancy</h3>
          <span className="text-xs text-muted-foreground font-semibold">
            {occupiedBeds} / {totalCapacity} occupied · {vacantBeds} beds vacant
          </span>
        </div>

        {/* Floor Progress Bars */}
        <div className="space-y-3">
          {floorOccupancy.length === 0 ? (
            <p className="text-xs text-muted-foreground">No floor data available.</p>
          ) : (
            floorOccupancy.slice(0, 3).map((floor: any) => (
              <div key={floor.floor} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>{floor.floor}</span>
                  <span>{floor.occupancy_rate}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all" 
                    style={{ width: `${floor.occupancy_rate}%` }} 
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rooms Badges list */}
        {roomUtilization.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
            {roomUtilization.slice(0, 12).map((room: any) => {
              const isFull = room.state === 'full';
              const badgeColor = isFull 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                : room.state === 'vacant'
                ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
              
              const statusText = isFull ? 'Full' : `${room.vacant} Vacant`;
              return (
                <div 
                  key={room.id} 
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${badgeColor}`}
                >
                  <span className="opacity-80">{room.room_no}</span>
                  <span className="font-bold">{statusText}</span>
                </div>
              );
            })}
          </div>
        )}

        <button 
          onClick={() => action('rooms')}
          className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-bold text-accent transition-colors"
        >
          Open Rooms
        </button>
      </section>

      {/* COLLECTIONS */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Collections</h3>
        
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold">Outstanding</div>
            <div className="text-sm font-bold text-foreground mt-1">{fmtExact(pendingTotal)}</div>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold">Overdue</div>
            <div className="text-sm font-bold text-foreground mt-1">{fmtExact(overdueTotal)}</div>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground font-semibold">Collection Rate</div>
            <div className="text-sm font-bold text-foreground mt-1">{collectionRate}%</div>
          </div>
        </div>

        <button 
          onClick={() => action('financials')}
          className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-bold text-accent transition-colors"
        >
          Open Billing
        </button>
      </section>


      {/* MOVE OUTS */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Move Outs</h3>

        <div className="grid grid-cols-3 gap-3">
          <div 
            onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
            className="bg-secondary/40 rounded-xl p-3 text-center cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <div className="text-[10px] text-muted-foreground font-semibold">Requests</div>
            <div className="text-sm font-bold text-foreground mt-1">{moveOutReqsCount}</div>
          </div>
          <div 
            onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
            className="bg-secondary/40 rounded-xl p-3 text-center cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <div className="text-[10px] text-muted-foreground font-semibold">Upcoming Vacancies</div>
            <div className="text-sm font-bold text-foreground mt-1">{upcomingVacanciesCount}</div>
          </div>
          <div 
            onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
            className="bg-secondary/40 rounded-xl p-3 text-center cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <div className="text-[10px] text-muted-foreground font-semibold">Pending Refunds</div>
            <div className="text-sm font-bold text-foreground mt-1">{pendingRefundsCount}</div>
          </div>
        </div>

        <button 
          onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
          className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-bold text-accent transition-colors"
        >
          Open Move-outs
        </button>
      </section>

      {/* OPERATIONAL TIMELINE */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Operational Timeline</h3>

        {activityLoading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className="text-xs">Loading timeline...</span>
          </div>
        ) : Object.keys(groupedActivity).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No activity logged yet. Payments, allocations, and expenses will appear here.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedActivity).map(([dayLabel, items]) => (
              <div key={dayLabel} className="space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  {dayLabel}
                </div>
                <div className="space-y-3 pl-1 border-l-2 border-secondary/60">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start gap-4 pl-3 relative">
                      <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card bg-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground leading-snug">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold shrink-0 mt-0.5">
                        {formatTime(item.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={() => navigate(`/hostels/${hostelId}/activity`)}
          className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-bold text-accent transition-colors"
        >
          View All
        </button>
      </section>

      {/* FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed right-4 bottom-20 z-20">
        {fabOpen && (
          <div className="mb-2 bg-card border border-border rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            {[
              { label: 'Add Tenant', icon: UserPlus, onClick: () => action('tenants') },
              { label: 'Add Expense', icon: Receipt, onClick: () => navigate(`/billing?hostelId=${hostelId}&action=expense`) },
              { label: 'Record Payment', icon: CreditCard, onClick: () => navigate(`/billing?hostelId=${hostelId}&action=payment`) },
              { label: 'Create Reminder', icon: Megaphone, onClick: () => navigate(`/billing?hostelId=${hostelId}&action=reminder`) },
              { label: 'Allocate Room', icon: Home, onClick: () => action('rooms') },
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={() => {
                  setFabOpen(false);
                  item.onClick();
                }} 
                className="w-44 px-4 py-3 text-xs font-semibold text-left flex items-center gap-2 hover:bg-secondary border-b border-border/40 last:border-b-0"
              >
                <item.icon className="w-3.5 h-3.5 text-muted-foreground" /> {item.label}
              </button>
            ))}
          </div>
        )}
        <button 
          onClick={() => setFabOpen((v) => !v)} 
          className="w-12 h-12 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Quick operations"
        >
          {fabOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
