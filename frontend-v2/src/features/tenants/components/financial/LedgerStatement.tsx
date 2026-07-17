import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

type LedgerFilter = 'all' | 'payments' | 'future_credit' | 'waivers' | 'adjustments' | 'deposits';

const FILTERS: { id: LedgerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'payments', label: 'Payments' },
  { id: 'future_credit', label: 'Future Credit' },
  { id: 'waivers', label: 'Waivers' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'deposits', label: 'Deposits' },
];

interface LedgerEntry {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  reason: string;
  amount: number;
  balance_after: number;
  notes?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  created_at: string;
}

interface LedgerStatementProps {
  entries: LedgerEntry[];
  balance: number;
}

function reasonLabel(reason: string): string {
  return reason.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchesFilter(entry: LedgerEntry, filter: LedgerFilter): boolean {
  if (filter === 'all') return true;
  const reason = entry.reason;
  if (filter === 'future_credit') return reason.startsWith('FUTURE_RENT_CREDIT') || reason === 'FUTURE_CREDIT_APPLIED';
  if (filter === 'waivers') return reason === 'OBLIGATION_WAIVER' || reason === 'OBLIGATION_CANCELLATION';
  if (filter === 'adjustments') return reason === 'LEDGER_CORRECTION';
  if (filter === 'deposits') return reason.startsWith('SECURITY_DEPOSIT');
  if (filter === 'payments') return reason === 'FUTURE_CREDIT_APPLIED' || reason.startsWith('SECURITY_DEPOSIT_COLLECTED');
  return true;
}

export function LedgerStatement({ entries, balance }: LedgerStatementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<LedgerFilter>('all');

  const grouped = useMemo(() => {
    const filtered = entries.filter((e) => matchesFilter(e, filter));
    const byDay = new Map<string, LedgerEntry[]>();
    for (const entry of filtered) {
      const dayKey = new Date(entry.created_at).toDateString();
      const list = byDay.get(dayKey) ?? [];
      list.push(entry);
      byDay.set(dayKey, list);
    }
    return Array.from(byDay.entries())
      .map(([dayKey, items]) => ({ dayKey, items }))
      .sort((a, b) => new Date(b.dayKey).getTime() - new Date(a.dayKey).getTime());
  }, [entries, filter]);

  return (
    <Collapsible id="fin-ledger" open={isOpen} onOpenChange={setIsOpen} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden scroll-mt-20">
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/5 transition-colors">
          <span className="flex items-center gap-2">
            <BookOpen className="w-4.5 h-4.5 text-accent" />
            <span className="text-sm font-bold text-foreground">Ledger &amp; Accounting Statement</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Balance: {fmt(balance)}</span>
            {isOpen ? <ChevronDown className="w-4.5 h-4.5 text-muted-foreground" /> : <ChevronRight className="w-4.5 h-4.5 text-muted-foreground" />}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 border-t border-border bg-secondary/5 space-y-4">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filter === f.id
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No ledger entries for this filter.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 scrollbar-hide">
              {grouped.map(({ dayKey, items }) => (
                <div key={dayKey} className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
                    {new Date(dayKey).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                    {items.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs bg-card">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{reasonLabel(entry.reason)}</p>
                          {(entry.notes || entry.reference_id) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {entry.reference_id ? `Ref: ${entry.reference_id}` : ''}
                              {entry.notes ? `${entry.reference_id ? ' · ' : ''}${entry.notes}` : ''}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.type === 'CREDIT' ? '+' : '-'}
                            {fmt(entry.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Bal {fmt(entry.balance_after)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border/40 text-sm font-bold">
            <span className="text-foreground">Current Balance</span>
            <span className="text-foreground">{fmt(balance)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
