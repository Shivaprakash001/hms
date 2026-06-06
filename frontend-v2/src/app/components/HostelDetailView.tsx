import { lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';
import { HOSTEL_DETAIL_TABS, normalizeHostelDetailTab, type HostelDetailTab } from './hostel-detail/types';
import { TabSkeleton } from './hostel-detail/shared/TabStates';

const OverviewTab = lazy(() => import('./hostel-detail/tabs/OverviewTab').then((m) => ({ default: m.OverviewTab })));
const RoomsTab = lazy(() => import('./hostel-detail/tabs/RoomsTab').then((m) => ({ default: m.RoomsTab })));
const TenantsTab = lazy(() => import('./hostel-detail/tabs/TenantsTab').then((m) => ({ default: m.TenantsTab })));
const FinancialsTab = lazy(() => import('./hostel-detail/tabs/FinancialsTab').then((m) => ({ default: m.FinancialsTab })));
const ExpensesTab = lazy(() => import('./hostel-detail/tabs/ExpensesTab').then((m) => ({ default: m.ExpensesTab })));
const MoveOutsTab = lazy(() => import('./hostel-detail/tabs/MoveOutsTab').then((m) => ({ default: m.MoveOutsTab })));
const HostelActivityCenterView = lazy(() => import('./views/HostelActivityCenterView').then((m) => ({ default: m.HostelActivityCenterView })));

function ActiveHostelTab({ activeTab, hostelId }: { activeTab: HostelDetailTab; hostelId: string }) {
  if (activeTab === 'rooms') return <RoomsTab hostelId={hostelId} />;
  if (activeTab === 'tenants') return <TenantsTab hostelId={hostelId} />;
  if (activeTab === 'financials') return <FinancialsTab hostelId={hostelId} />;
  if (activeTab === 'expenses') return <ExpensesTab hostelId={hostelId} />;
  if (activeTab === 'moveouts') return <MoveOutsTab hostelId={hostelId} />;
  if (activeTab === 'activity') return <HostelActivityCenterView hostelId={hostelId} />;
  return <OverviewTab hostelId={hostelId} />;
}

export function HostelDetailView() {
  const { hostelId, tab } = useParams<{ hostelId: string; tab?: string }>();
  const navigate = useNavigate();
  const activeTab = normalizeHostelDetailTab(tab);

  const { data: hostels = [] } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  if (!hostelId) return null;

  const hostelList = Array.isArray(hostels) ? hostels : (hostels as { hostels?: unknown[] })?.hostels || [];
  const hostel = hostelList.find((h: { id: string }) => h.id === hostelId) as any;
  const openTab = (nextTab: HostelDetailTab) => {
    navigate(nextTab === 'overview' ? '/hostels/' + hostelId : '/hostels/' + hostelId + '/' + nextTab);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-border z-10">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 -ml-2 shrink-0 active:scale-95 transition-transform touch-manipulation"
                aria-label="Back to dashboard"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-foreground text-base leading-none truncate">
                  {hostel ? hostel.name : 'Hostel'}
                </h1>
                {hostel && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 font-medium">
                    <span className="truncate">
                      {hostel.city || hostel.address || 'Location not set'}
                      {hostel.status && ` • ${String(hostel.status).charAt(0).toUpperCase() + String(hostel.status).slice(1).toLowerCase()}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {HOSTEL_DETAIL_TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => openTab(item.id)}
                className={
                  'shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors touch-manipulation ' +
                  (activeTab === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground active:text-foreground')
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 min-w-0">
        <Suspense fallback={<TabSkeleton />}>
          <ActiveHostelTab activeTab={activeTab} hostelId={hostelId} />
        </Suspense>
      </div>
    </div>
  );
}
