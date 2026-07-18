import { useState } from 'react';
import { CalendarDays, Copy, Edit3, MoreHorizontal, Paperclip, PauseCircle, Repeat2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

// Dense single row: the whole card is the "View" action (tap/click anywhere
// opens the Details panel); everything else lives behind the ••• overflow
// menu instead of 4 permanent buttons.
export function ExpenseCard({
  expense,
  selected = false,
  onToggleSelect,
  onView,
  onEdit,
  onDuplicate,
  onMarkPending,
  onDelete,
}: {
  expense: Record<string, any>;
  selected?: boolean;
  onToggleSelect?: () => void;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMarkPending: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = categoryTone(String(expense.category || 'Miscellaneous'));
  const status = String(expense.status || 'paid').toUpperCase();
  const date = expense.date
    ? new Date(String(expense.date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : 'No date';

  return (
    <div
      className={`group relative rounded-xl border bg-card transition-colors hover:border-accent/40 ${
        selected ? 'border-accent/50 bg-accent/5' : 'border-border'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView();
          }
        }}
        className={`flex cursor-pointer items-start justify-between gap-3 p-3 pr-11 ${onToggleSelect ? 'pl-11' : ''}`}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleSelect}
            aria-label={`Select ${expense.title || 'expense'}`}
            className="absolute left-3 top-4 h-4 w-4 shrink-0 accent-accent"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
              {String(expense.category || 'Misc')}
            </span>
            {expense.receipt_url && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {expense.is_recurring && <Repeat2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
            {String(expense.title || expense.vendor_name || 'Expense')}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {[date, expense.vendor_name, expense.payment_method ? `via ${expense.payment_method}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-foreground">{fmtExact(expense.amount)}</p>
          <p
            className={`mt-1 text-[10px] font-semibold ${
              status === 'PAID' ? 'text-success' : status === 'CANCELLED' ? 'text-destructive' : 'text-warning'
            }`}
          >
            {status}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-2.5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onEdit}>
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMarkPending}>
            <PauseCircle className="h-3.5 w-3.5" /> Mark Pending
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{String(expense.title || 'this expense')}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
