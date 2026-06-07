export type HostelDetailTab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'expenses' | 'moveouts' | 'activity';

export const HOSTEL_DETAIL_TABS: { id: HostelDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'moveouts', label: 'Move-Outs' },
];

export function normalizeHostelDetailTab(tab: string | undefined): HostelDetailTab {
  if (tab === 'activity') return 'activity';
  return HOSTEL_DETAIL_TABS.some((item) => item.id === tab) ? (tab as HostelDetailTab) : 'overview';
}

