import { useState } from 'react';
import { ChevronDown, Upload, X } from 'lucide-react';

const QUICK_CATEGORIES = [
  'Food & Groceries',
  'Staff Salary',
  'Electricity',
  'Water',
  'Gas Cylinder',
  'Internet',
  'Repairs',
  'Cleaning',
];
const QUICK_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Debit Card', 'Credit Card', 'Cheque'];
const QUICK_TEMPLATES = [
  { label: 'Electricity Bill', category: 'Electricity', method: 'UPI', title: 'Electricity bill' },
  { label: 'Water Bill', category: 'Water', method: 'UPI', title: 'Water bill' },
  { label: 'Internet Bill', category: 'Internet', method: 'UPI', title: 'Internet bill' },
  { label: 'Staff Salary', category: 'Staff Salary', method: 'Bank Transfer', title: 'Staff salary' },
  { label: 'Gas Cylinder', category: 'Gas Cylinder', method: 'UPI', title: 'Gas cylinder' },
  { label: 'Food Purchase', category: 'Food & Groceries', method: 'UPI', title: 'Food purchase' },
];

export function AddExpenseModal({
  categories,
  loading,
  onClose,
  onSubmit,
}: {
  categories: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Miscellaneous',
    date: new Date().toISOString().slice(0, 10),
    status: 'paid',
    notes: '',
    payment_method: '',
    vendor_name: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
    expense_type: 'OPERATIONAL',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showMore, setShowMore] = useState(false);
  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';
  const categoryOptions = Array.from(new Set([...QUICK_CATEGORIES, ...categories, 'Asset Purchase', 'Miscellaneous']));
  const amountValue = Number(form.amount);
  const canSave =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(form.category) &&
    Boolean(form.payment_method) &&
    Boolean(form.vendor_name.trim()) &&
    Boolean(form.date);
  const generatedTitle = form.title.trim() || [form.vendor_name.trim(), form.category].filter(Boolean).join(' · ') || `${form.category} expense`;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      ...form,
      title: generatedTitle,
      amount: amountValue,
      category: form.category,
      notes: form.notes.trim() || undefined,
      vendor_name: form.vendor_name.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      expense_type: form.category === 'Asset Purchase' ? 'CAPITAL' : form.expense_type,
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="px-4 pt-4">
            <h3 className="text-lg font-bold text-foreground">Add expense</h3>
            <p className="text-xs text-muted-foreground">Amount first. Details only when needed.</p>
          </div>
          <button type="button" onClick={onClose} className="mr-2 mt-2 p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 pb-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick templates
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      title: template.title,
                      category: template.category,
                      payment_method: template.method,
                      expense_type: template.category === 'Asset Purchase' ? 'CAPITAL' : 'OPERATIONAL',
                    }))
                  }
                  className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount paid
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">₹</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-2xl border border-border bg-background py-4 pl-10 pr-4 text-3xl font-bold outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category, expense_type: category === 'Asset Purchase' ? 'CAPITAL' : f.expense_type }))}
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
              onChange={(e) => {
                const category = e.target.value;
                setForm((f) => ({ ...f, category, expense_type: category === 'Asset Purchase' ? 'CAPITAL' : f.expense_type }));
              }}
              className="mt-2 w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
            >
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Expense type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'OPERATIONAL', label: 'Operational', hint: 'Monthly running cost' },
                { value: 'CAPITAL', label: 'Capital', hint: 'Asset purchase' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, expense_type: type.value, category: type.value === 'CAPITAL' && f.category === 'Miscellaneous' ? 'Asset Purchase' : f.category }))}
                  className={`rounded-xl border p-3 text-left ${
                    form.expense_type === type.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground'
                  }`}
                >
                  <span className="block text-sm font-semibold">{type.label}</span>
                  <span className={`mt-0.5 block text-[10px] ${form.expense_type === type.value ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                    {type.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor, e.g. milk supplier, electrician, owner"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />

          <input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category }));
            }}
            placeholder="Short note, e.g. EB bill or rice purchase"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          {suggestion && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
              className="rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent"
            >
              Use suggested category: {suggestion}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment method
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {QUICK_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_method: method }))}
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

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold"
          >
            Receipt, vendor and recurring options
            <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>

          {showMore && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Extra notes"
                rows={2}
                className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none"
              />
              <label className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-muted/40">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {receiptFile ? receiptFile.name : 'Attach receipt image'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP under 4MB</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                <span className="text-sm font-medium text-foreground">Recurring expense</span>
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                />
              </label>
              {form.is_recurring && (
                <select value={form.recurring_frequency} onChange={(e) => setForm((f) => ({ ...f, recurring_frequency: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSave}
            className="w-full py-3.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50 active:scale-[0.99] transition-transform"
          >
            {loading
              ? 'Saving...'
              : !form.vendor_name.trim()
                ? 'Add vendor to save'
                : !form.payment_method
                  ? 'Choose payment method'
                  : `Save ${amountValue > 0 ? `₹${amountValue.toLocaleString('en-IN')}` : 'expense'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function suggestExpenseCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal|dal|oil)/.test(text)) return 'Food & Groceries';
  if (/(gas|cylinder|lpg)/.test(text)) return 'Gas Cylinder';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter)/.test(text)) return 'Repairs';
  if (/(clean|housekeep)/.test(text)) return 'Cleaning';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(water|tanker)/.test(text)) return 'Water';
  if (/(asset|washing machine|machine|bed|mattress|furniture|fridge|geyser|fan|cctv)/.test(text)) return 'Asset Purchase';
  return 'Miscellaneous';
}
