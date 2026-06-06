export type HostelDetailTab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'expenses' | 'moveouts';

export const HOSTEL_DETAIL_TABS: { id: HostelDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'financials', label: 'Financials' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'moveouts', label: 'Move-Outs' },
];

export function normalizeHostelDetailTab(tab: string | undefined): HostelDetailTab {
  return HOSTEL_DETAIL_TABS.some((item) => item.id === tab) ? (tab as HostelDetailTab) : 'overview';
}

