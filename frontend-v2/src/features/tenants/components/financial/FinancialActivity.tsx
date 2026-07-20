import { useMemo, useState } from 'react';
import { Loader2, ListFilter, Banknote, ReceiptText, HandCoins, Wallet, FileCheck2 } from 'lucide-react';
import { groupFinancialActivity } from '@features/tenants/utils/groupFinancialActivity';
import type { TimelineEvent } from '@features/tenants/utils/financialColors';
import { FinancialActivityCard } from './FinancialActivityCard';

type FilterCategory = 'all' | 'payments' | 'charges' | 'waivers' | 'credit' | 'agreement';

const FILTER_CHIPS: { id: FilterCategory; label: string; icon: typeof ListFilter }[] = [
  { id: 'all', label: 'All', icon: ListFilter },
  { id: 'payments', label: 'Payments', icon: Banknote },
  { id: 'charges', label: 'Charges', icon: ReceiptText },
  { id: 'waivers', label: 'Waivers', icon: HandCoins },
  { id: 'credit', label: 'Credit', icon: Wallet },
  { id: 'agreement', label: 'Agreement', icon: FileCheck2 },
];

function matchesFilter(event: TimelineEvent, filter: FilterCategory): boolean {
  if (filter === 'all') return true;
  if (filter === 'payments') return event.type === 'PAYMENT_RECORDED' || event.type === 'PAYMENT_GROUP_SETTLED';
  if (filter === 'charges') return event.type === 'OBLIGATION_CREATED';
  if (filter === 'waivers') return event.type === 'OBLIGATION_WAIVED' || event.type === 'OBLIGATION_CANCELLED';
  if (filter === 'credit') return event.type === 'LEDGER_CREDIT' || event.type === 'LEDGER_DEBIT';
  if (filter === 'agreement') return event.type === 'CHANGE_REQUEST';
  return true;
}

interface FinancialActivityProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  onDownloadReceipt?: (paymentId: string) => void;
  onViewObligation?: (obligationId: string) => void;
  onCorrectPayment?: (paymentId: string) => void;
}

const PAGE_SIZE = 8;

export function FinancialActivity({ events, isLoading, onDownloadReceipt, onViewObligation, onCorrectPayment }: FinancialActivityProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const grouped = useMemo(() => groupFinancialActivity(events), [events]);

  const filtered = useMemo(
    () => grouped.filter((entry) => matchesFilter(entry.primary, activeFilter)),
    [grouped, activeFilter],
  );

  const visible = filtered.slice(0, visibleCount);

  return (
    <div id="fin-activity" className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4 scroll-mt-20">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">Financial Activity</h3>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {FILTER_CHIPS.map((chip) => {
          const ChipIcon = chip.icon;
          const isSelected = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setActiveFilter(chip.id);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/10'
              }`}
            >
              <ChipIcon className="w-3.5 h-3.5" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">No financial activity recorded yet.</p>
      ) : (
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 scrollbar-hide">
          {visible.map((entry) => (
            <FinancialActivityCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onDownloadReceipt={onDownloadReceipt}
              onViewObligation={onViewObligation}
              onCorrectPayment={onCorrectPayment}
            />
          ))}
          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-2 text-xs font-semibold text-accent hover:underline"
            >
              Load more ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
