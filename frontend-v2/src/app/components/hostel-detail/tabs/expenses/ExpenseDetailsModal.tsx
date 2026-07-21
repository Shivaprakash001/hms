import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@shared/ui';
import { fmtExact } from '../../shared/format';
import { categoryTone } from '@features/expenses/constants';
import { ReceiptPreview } from './ReceiptPreview';

export function ExpenseDetailsModal({
  expense,
  categoryBreakdown = [],
  onClose,
  onEdit,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  categoryBreakdown?: Record<string, any>[];
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  const status = String(expense.status || 'paid').toUpperCase();
  const title = String(expense.title || '');

  const categoryStat = categoryBreakdown.find((c) => c.category === expense.category);

  const { data: titleSummary } = useQuery({
    queryKey: ['expenses', 'title_summary', title],
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getTitleSummary(title)),
    enabled: title.length > 0,
    staleTime: 3 * 60 * 1000,
  });
  const summary = titleSummary?.summary;
  const lastTransaction = Array.isArray(titleSummary?.transactions)
    ? titleSummary.transactions.find((t: any) => String(t.id) !== String(expense.id))
    : null;
  const hasSimilarHistory = summary && Number(summary.total_transactions || 0) > 1;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expense Details</span>
          <ResponsiveDialogTitle className="truncate">{title || 'Expense'}</ResponsiveDialogTitle>
          <p className="text-xl font-black text-accent">{fmtExact(expense.amount)}</p>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {expense.receipt_url && <ReceiptPreview url={String(expense.receipt_url)} variant="card" />}

          <div className="divide-y divide-border/60 rounded-2xl border border-border bg-background/50 overflow-hidden">
            <DetailRow
              label="Category"
              rightElement={
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone.chip}`}>
                  {String(expense.category || 'Misc')}
                </span>
              }
            />
            <DetailRow
              label="Status"
              rightElement={
                <span
                  className={`text-xs font-bold ${
                    status === 'PAID' ? 'text-success' : status === 'CANCELLED' ? 'text-destructive' : 'text-warning'
                  }`}
                >
                  {status}
                </span>
              }
            />
            <DetailRow label="Payment" value={expense.payment_method ? `Paid via ${expense.payment_method}` : 'Not set'} />
            <DetailRow
              label="Date"
              value={
                expense.date
                  ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
                  : 'No date'
              }
            />
            <DetailRow label="Vendor" value={String(expense.vendor_name || 'Not set')} />
            <DetailRow label="Recorded by" value={String(expense.added_by || 'Owner')} />
            <DetailRow
              label="Added on"
              value={
                expense.created_at
                  ? new Date(String(expense.created_at)).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
                  : 'Unknown'
              }
            />
          </div>

          {/* Decision support: category trend */}
          {categoryStat?.anomaly && (
            <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/5 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-xs font-bold text-foreground">{categoryStat.anomaly}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Worth checking if this category's costs are still in line with expectations.
                </p>
              </div>
            </div>
          )}

          {/* Decision support: similar past expenses, reusing the same title-summary query the search box uses */}
          {hasSimilarHistory && (
            <div className="rounded-2xl border border-border bg-background/50 p-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <p className="text-xs font-bold text-foreground">You've paid this before</p>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {summary.total_transactions} times total · avg {fmtExact(summary.average_monthly)}/month
                {lastTransaction ? ` · last time ${fmtExact(lastTransaction.amount)}` : ''}
              </p>
            </div>
          )}

          {expense.notes && (
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-1.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">{String(expense.notes)}</p>
            </div>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-accent py-2.5 text-xs font-bold text-accent-foreground active:scale-[0.98] transition-all sm:col-span-1"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-xl border border-accent/30 bg-accent/10 py-2.5 text-xs font-bold text-accent active:scale-[0.98] transition-all"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={onMarkPending}
              className="rounded-xl border border-accent/30 bg-accent/10 py-2.5 text-xs font-bold text-accent active:scale-[0.98] transition-all"
            >
              Mark Pending
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-xs font-bold text-destructive active:scale-[0.98] transition-all"
            >
              Delete
            </button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{title || 'this expense'}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveDialog>
  );
}

function DetailRow({ label, value, rightElement }: { label: string; value?: string; rightElement?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      {rightElement ? rightElement : <span className="font-bold text-foreground truncate max-w-[200px]">{value}</span>}
    </div>
  );
}
