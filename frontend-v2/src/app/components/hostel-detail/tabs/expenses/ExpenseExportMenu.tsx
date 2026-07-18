import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui';

export type ExpenseExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExpenseExportScope = 'current_view' | 'all_matching' | 'selected';

const FORMAT_LABELS: Record<ExpenseExportFormat, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' };

// Export action, deliberately placed next to search/filters. Scope options are
// "future-ready": Selected Expenses is always offered but only enabled once the owner
// has actually checked rows in the list (selectedCount > 0).
export function ExpenseExportMenu({
  onExport,
  exporting,
  currentViewCount,
  totalCount,
  selectedCount,
}: {
  onExport: (opts: { format: ExpenseExportFormat; scope: ExpenseExportScope }) => void;
  exporting: boolean;
  currentViewCount: number;
  totalCount: number;
  selectedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExpenseExportFormat>('csv');
  const [scope, setScope] = useState<ExpenseExportScope>('all_matching');

  const scopeOptions: { value: ExpenseExportScope; label: string; detail: string; disabled?: boolean }[] = [
    {
      value: 'current_view',
      label: 'Current View',
      detail: `${currentViewCount} loaded row${currentViewCount === 1 ? '' : 's'}`,
      disabled: currentViewCount === 0,
    },
    {
      value: 'all_matching',
      label: 'All Matching Records',
      detail: `${totalCount} record${totalCount === 1 ? '' : 's'} match your filters`,
      disabled: totalCount === 0,
    },
    {
      value: 'selected',
      label: 'Selected Expenses',
      detail: selectedCount > 0 ? `${selectedCount} selected` : 'Select rows in the list to enable',
      disabled: selectedCount === 0,
    },
  ];

  const effectiveScope = scopeOptions.find((o) => o.value === scope)?.disabled ? 'all_matching' : scope;

  const submit = () => {
    onExport({ format, scope: effectiveScope });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={exporting}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(FORMAT_LABELS) as ExpenseExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                  format === f ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope</p>
          <div className="space-y-1.5">
            {scopeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => setScope(opt.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                  effectiveScope === opt.value ? 'border-accent bg-accent/10' : 'border-border'
                }`}
              >
                <span>
                  <span className="block text-xs font-semibold text-foreground">{opt.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{opt.detail}</span>
                </span>
                {effectiveScope === opt.value && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={exporting || totalCount === 0}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : `Export ${FORMAT_LABELS[format]}`}
        </button>
      </PopoverContent>
    </Popover>
  );
}
