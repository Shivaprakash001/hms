export function readHostels(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown>)?.hostels))
    return (obj.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  return [];
}

export function fmtDate(value: unknown) {
  if (!value) return 'Not set';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function stateLabel(state: string) {
  switch (state) {
    case 'EXPIRED_AND_RENT_OVERDUE': return 'Expired + Rent Overdue';
    case 'RENEWAL_OVERDUE_CRITICAL': return 'Overdue Critical';
    case 'RENEWAL_DECISION_PENDING': return 'Renewal Pending';
    case 'MOVE_OUT_IN_PROGRESS': return 'Move-out Conflict';
    case 'EXPIRING_SOON': return 'Expiring Soon';
    case 'RENEWAL_AVAILABLE': return 'Renewal Available';
    default: return state.replace(/_/g, ' ');
  }
}

export function statusBadgeColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'SENT': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'ACCEPTED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'DECLINED': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'EXPIRED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'REVISED': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800';
  }
}

export function isCriticalState(state: string) {
  return state === 'EXPIRED_AND_RENT_OVERDUE' || state === 'RENEWAL_OVERDUE_CRITICAL';
}

export function initials(name: unknown) {
  const str = String(name || '').trim();
  if (!str) return '?';
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function currentAgreementTerms(agreement: Record<string, any>) {
  return {
    rent: Number(agreement?.contract?.rent ?? agreement?.contract_rent ?? 0),
    deposit: Number(agreement?.contract?.security_deposit ?? agreement?.contract_security_deposit ?? 0),
    duration: Number(agreement?.contract?.agreement_duration_months ?? agreement?.contract_duration_months ?? 11),
  };
}

/** Distinct room categories/floors/room-numbers present in a set of queue
 * rows — used to populate both the queue's Room No./Room Type/Floor filters
 * and the Campaign Wizard's per-category/per-floor/per-room pricing inputs
 * from the same source of truth. */
export function deriveRoomGroupings(rows: any[]) {
  const categories = new Set<string>();
  const floors = new Set<string>();
  const rooms = new Set<string>();
  rows.forEach((row: any) => {
    const type = row.tenant?.room?.room_type;
    const floor = row.tenant?.room?.floor_name;
    const roomNo = row.tenant?.room?.room_no;
    if (type) categories.add(type);
    if (floor) floors.add(floor);
    if (roomNo) rooms.add(roomNo);
  });
  return {
    categories: Array.from(categories),
    floors: Array.from(floors),
    rooms: Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
}
