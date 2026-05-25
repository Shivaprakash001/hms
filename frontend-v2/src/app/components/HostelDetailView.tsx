import { lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MapPin } from 'lucide-react';
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

function ActiveHostelTab({ activeTab, hostelId }: { activeTab: HostelDetailTab; hostelId: string }) {
  if (activeTab === 'rooms') return <RoomsTab hostelId={hostelId} />;
  if (activeTab === 'tenants') return <TenantsTab hostelId={hostelId} />;
  if (activeTab === 'financials') return <FinancialsTab hostelId={hostelId} />;
  if (activeTab === 'expenses') return <ExpensesTab hostelId={hostelId} />;
  if (activeTab === 'moveouts') return <MoveOutsTab hostelId={hostelId} />;
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
  const hostel = hostelList.find((h: { id: string }) => h.id === hostelId);
  const openTab = (nextTab: HostelDetailTab) => {
    navigate(nextTab === 'overview' ? '/hostels/' + hostelId : '/hostels/' + hostelId + '/' + nextTab);
  };

  return (
    <div className="min-h-screen bg-background">
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

