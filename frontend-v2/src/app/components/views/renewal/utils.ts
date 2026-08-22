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

/** ---------------------------------------------------------------------------
 * Unified renewal pipeline vocabulary
 *
 * `stage` is where a tenant sits in the renewal lifecycle; urgency (lapsed
 * contract, overdue rent, move-out) is rendered separately. The old queue fused
 * the two into one badge, which is why a tenant who had already been sent an
 * offer still read as "Expired". Mirrors RENEWAL_STAGES in
 * backend-next/src/services/tenants/renewal-pipeline-read-model.ts.
 * ------------------------------------------------------------------------- */

export type RenewalStage =
  | 'NEEDS_OFFER'
  | 'DRAFT'
  | 'INVITED'
  | 'NEGOTIATING'
  | 'AWAITING_PAYMENT'
  | 'READY_FOR_SIGNATURE'
  | 'RENEWAL_DRAFTED'
  | 'RENEWED'
  | 'DECLINED'
  | 'OFFER_EXPIRED'
  | 'MOVE_OUT';

/** Chip order — owner-actionable stages first, then waiting-on-tenant, then done. */
export const STAGE_ORDER: RenewalStage[] = [
  'NEEDS_OFFER',
  'DRAFT',
  'INVITED',
  'NEGOTIATING',
  'OFFER_EXPIRED',
  'DECLINED',
  'AWAITING_PAYMENT',
  'READY_FOR_SIGNATURE',
  'RENEWAL_DRAFTED',
  'RENEWED',
  'MOVE_OUT',
];

const STAGE_LABELS: Record<RenewalStage, string> = {
  NEEDS_OFFER: 'Needs Offer',
  DRAFT: 'Draft',
  INVITED: 'Invited',
  NEGOTIATING: 'Negotiating',
  AWAITING_PAYMENT: 'Awaiting Payment',
  READY_FOR_SIGNATURE: 'Ready to Sign',
  RENEWAL_DRAFTED: 'Renewal Drafted',
  RENEWED: 'Renewed',
  DECLINED: 'Declined',
  OFFER_EXPIRED: 'Offer Expired',
  MOVE_OUT: 'Moving Out',
};

export function stageLabel(stage: string) {
  return STAGE_LABELS[stage as RenewalStage] || String(stage).replace(/_/g, ' ');
}

const STAGE_COLORS: Record<RenewalStage, string> = {
  NEEDS_OFFER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  INVITED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  NEGOTIATING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  READY_FOR_SIGNATURE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  RENEWAL_DRAFTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  RENEWED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DECLINED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  OFFER_EXPIRED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  MOVE_OUT: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function stageBadgeColor(stage: string) {
  return STAGE_COLORS[stage as RenewalStage] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

/** Stages where the ball is in the owner's court. Drives the "Needs you" grouping. */
const OWNER_ACTION_STAGES: RenewalStage[] = ['NEEDS_OFFER', 'DRAFT', 'OFFER_EXPIRED', 'DECLINED', 'AWAITING_PAYMENT', 'READY_FOR_SIGNATURE', 'RENEWAL_DRAFTED'];

export function needsOwnerAction(stage: string) {
  return OWNER_ACTION_STAGES.includes(stage as RenewalStage);
}

/** Human phrasing for how long ago the contract lapsed / how long until it does. */
export function expiryPhrase(row: { urgency?: { days_overdue?: number; days_until_expiry?: number | null; contract_lapsed?: boolean } }) {
  const days = Number(row?.urgency?.days_overdue || 0);
  if (row?.urgency?.contract_lapsed && days > 0) return `Expired ${days}d ago`;
  const until = row?.urgency?.days_until_expiry;
  if (typeof until === 'number') return until === 0 ? 'Expires today' : `Expires in ${until}d`;
  return null;
}

/** Days remaining on an offer's response window; negative once it has lapsed. */
export function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const target = new Date(String(value)).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
}
