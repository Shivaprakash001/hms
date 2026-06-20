import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Upload, X, Zap, Clock, FileText, Camera } from 'lucide-react';

const QUICK_CATEGORIES = [
  'Food & Groceries',
  'Staff Salary',
  'Electricity',
  'Water',
  'Gas Cylinders',
  'Internet',
  'Cleaning Supplies',
  'Maintenance & Repairs',
];
const QUICK_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Debit Card', 'Credit Card', 'Cheque'];
const BUSINESS_CATEGORIES = [
  'Food & Groceries',
  'Staff Salary',
  'Electricity',
  'Water',
  'Gas Cylinders',
  'Internet',
  'Cleaning Supplies',
  'Maintenance & Repairs',
  'Security',
  'Laundry',
  'Transportation',
  'Furniture & Equipment',
  'Licenses & Government',
  'Marketing',
  'Medical & Emergency',
  'Miscellaneous',
];

const OPERATIONAL_TYPES = [
  { value: 'Operational', label: 'Operational', emoji: '⚙️' },
  { value: 'Utility', label: 'Utility', emoji: '💡' },
  { value: 'Maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'Staff', label: 'Staff', emoji: '👨‍🍳' },
  { value: 'Emergency', label: 'Emergency', emoji: '🚨' },
];

export function AddExpenseModal({
  categories,
  loading,
  mode = 'create',
  initialExpense,
  onClose,
  onSubmit,
}: {
  categories: string[];
  loading: boolean;
  mode?: 'create' | 'edit';
  initialExpense?: Record<string, any> | null;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => expenseToForm(initialExpense));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Fetch frequent expense suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['expenses', 'suggestions'],
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getSuggestions()),
    staleTime: 5 * 60 * 1000,
  });

  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';
  const categoryOptions = Array.from(new Set([...QUICK_CATEGORIES, ...categories, ...BUSINESS_CATEGORIES]));
  const amountValue = Number(form.amount);
  const canSave =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(form.title.trim()) &&
    Boolean(form.category) &&
    Boolean(form.date);

  // Title autocomplete filtering
  const filteredSuggestions = useMemo(() => {
    if (!form.title.trim() || !Array.isArray(suggestions) || suggestions.length === 0) return [];
    const query = form.title.trim().toLowerCase();
    return suggestions.filter((s: any) =>
      String(s.title || '').toLowerCase().includes(query)
    );
  }, [form.title, suggestions]);

  const applySuggestion = (s: any) => {
    setForm((f) => ({
      ...f,
      title: s.title || f.title,
      amount: s.last_amount ? String(s.last_amount) : f.amount,
      category: s.category || f.category,
      payment_method: s.payment_method || f.payment_method,
      operational_type: s.suggested_operational_type || suggestedOperationalType(s.title || '', s.category || ''),
    }));
    setShowAutoComplete(false);
  };

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      amount: amountValue,
      category: form.category,
      notes: form.notes.trim() || undefined,
      vendor_name: form.vendor_name.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      operational_type: form.operational_type || undefined,
      expense_scope: 'BUSINESS',
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 pb-3">
          <div className="px-4 pt-4">
            <h3 className="text-lg font-bold text-foreground">
              {mode === 'edit' ? 'Edit expense' : 'Add expense'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit' ? 'Update the expense details.' : 'Title → Amount → Category → Save. Fast.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="mr-2 mt-2 p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Smart Suggestions — Quick Add from Memory */}
          {mode === 'create' && Array.isArray(suggestions) && suggestions.length > 0 && !form.title.trim() && (
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Zap className="h-3 w-3 text-accent" />
                Frequently used
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {suggestions.slice(0, 6).map((s: any, i: number) => (
                  <button
                    key={`${s.title}-${i}`}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="shrink-0 rounded-2xl border border-border bg-background p-3 text-left min-w-[140px] hover:border-accent/40 active:scale-[0.98] transition-all"
                  >
                    <p className="text-sm font-bold text-foreground truncate">{s.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last ₹{Number(s.last_amount || 0).toLocaleString('en-IN')}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{s.occurrence_count}× used</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Title — First-class, with autocomplete */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Expense title *
            </label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({
                  ...f,
                  title,
                  category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category,
                  operational_type: suggestedOperationalType(title, f.category),
                }));
                setShowAutoComplete(true);
              }}
              onFocus={() => setShowAutoComplete(true)}
              onBlur={() => setTimeout(() => setShowAutoComplete(false), 200)}
              placeholder="e.g. Rice purchase, Electricity bill, Staff salary"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
            {suggestion && suggestion !== form.category && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
                className="mt-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent"
              >
                Use suggested category: {suggestion}
              </button>
            )}

            {/* Autocomplete dropdown */}
            {showAutoComplete && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {filteredSuggestions.map((s: any, i: number) => (
                  <button
                    key={`auto-${i}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(s)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{s.category} · {s.occurrence_count}× used</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-accent">
                      ₹{Number(s.last_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Amount */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-2xl border border-border bg-background py-4 pl-10 pr-4 text-3xl font-bold outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {/* 3. Category */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category }))}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    form.category === category
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-2 w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
            >
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>

          {/* 4. Date + Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* 5. Payment method (optional) */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment method <span className="text-muted-foreground/60 normal-case">(optional)</span>
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {QUICK_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_method: f.payment_method === method ? '' : method }))}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                    form.payment_method === method
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Expense Type (HMS operational classification) */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Expense type <span className="text-muted-foreground/60 normal-case">(auto-detected)</span>
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {OPERATIONAL_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, operational_type: type.value }))}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                    form.operational_type === type.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {type.emoji} {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Vendor (optional) */}
          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor (optional), e.g. milk supplier"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />

          {/* 8. Notes (independent, always visible) */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3 w-3" />
              Notes <span className="text-muted-foreground/60 normal-case">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Monthly grocery stock purchase, no receipt available"
              rows={2}
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none"
            />
          </div>

          {/* 9. Receipt (independent, always visible) */}
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-muted/40">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {receiptFile ? receiptFile.name : 'Attach receipt image'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {receiptFile ? 'Tap to change' : 'Optional · JPG, PNG or WEBP under 4MB'}
              </p>
            </div>
            {receiptFile && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setReceiptFile(null); }}
                className="rounded-lg p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
          </label>

          {/* 10. Recurring toggle */}
          <div className="rounded-xl border border-border bg-background p-3 space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Recurring expense</span>
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
              />
            </label>
            {form.is_recurring && (
              <select value={form.recurring_frequency} onChange={(e) => setForm((f) => ({ ...f, recurring_frequency: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="shrink-0 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSave}
            className="w-full py-3.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50 active:scale-[0.99] transition-transform"
          >
            {loading
              ? 'Saving...'
              : !form.title.trim()
                ? 'Add title to save'
                : !form.category || form.category === 'Miscellaneous'
                  ? 'Choose a category'
                  : `${mode === 'edit' ? 'Update' : 'Save'} ${amountValue > 0 ? `₹${amountValue.toLocaleString('en-IN')}` : 'expense'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function expenseToForm(expense?: Record<string, any> | null) {
  return {
    title: String(expense?.title || ''),
    amount: expense?.amount ? String(expense.amount) : '',
    category: String(expense?.category || 'Miscellaneous'),
    date: expense?.date ? new Date(String(expense.date)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: String(expense?.status || 'paid'),
    notes: String(expense?.notes || ''),
    payment_method: String(expense?.payment_method || ''),
    vendor_name: String(expense?.vendor_name || ''),
    is_recurring: Boolean(expense?.is_recurring),
    recurring_frequency: String(expense?.recurring_frequency || 'monthly'),
    operational_type: String(expense?.operational_type || suggestedOperationalType(expense?.title || '', expense?.category || '')),
  };
}

function suggestExpenseCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal|dal|oil)/.test(text)) return 'Food & Groceries';
  if (/(gas|cylinder|lpg)/.test(text)) return 'Gas Cylinders';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter|maintenance)/.test(text)) return 'Maintenance & Repairs';
  if (/(clean|housekeep|soap|phenyl)/.test(text)) return 'Cleaning Supplies';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(security|guard|cctv)/.test(text)) return 'Security';
  if (/(laundry|washing)/.test(text)) return 'Laundry';
  if (/(transport|auto|fuel|petrol|diesel)/.test(text)) return 'Transportation';
  if (/(bed|mattress|furniture|fridge|geyser|fan|machine|equipment)/.test(text)) return 'Furniture & Equipment';
  if (/(license|licence|government|tax|permit)/.test(text)) return 'Licenses & Government';
  if (/(marketing|banner|ad|poster)/.test(text)) return 'Marketing';
  if (/(medical|emergency|first aid|doctor)/.test(text)) return 'Medical & Emergency';
  if (/(water|tanker)/.test(text)) return 'Water';
  return 'Miscellaneous';
}

function suggestedOperationalType(title: string, category: string) {
  const text = `${title} ${category}`.toLowerCase();
  if (/(salary|staff|warden|watchman|cook|guard)/.test(text)) return 'Staff';
  if (/(electric|water|gas|internet|wifi|broadband|sewage)/.test(text)) return 'Utility';
  if (/(repair|plumb|paint|fix|carpenter|leak|pipe|roof|maintenance)/.test(text)) return 'Maintenance';
  if (/(emergency|urgent|flood|fire|accident|break)/.test(text)) return 'Emergency';
  return 'Operational';
}
