import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Upload, X } from 'lucide-react';

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
const QUICK_TEMPLATES = [
  { label: 'Electricity Bill', category: 'Electricity', method: 'UPI', title: 'Electricity bill' },
  { label: 'Water Bill', category: 'Water', method: 'UPI', title: 'Water bill' },
  { label: 'Internet Bill', category: 'Internet', method: 'UPI', title: 'Internet bill' },
  { label: 'Staff Salary', category: 'Staff Salary', method: 'Bank Transfer', title: 'Staff salary' },
  { label: 'Gas Cylinder', category: 'Gas Cylinders', method: 'UPI', title: 'Gas cylinder' },
  { label: 'Food Purchase', category: 'Food & Groceries', method: 'UPI', title: 'Food purchase' },
];

export function AddExpenseModal({
  categories,
  loading,
  mode = 'create',
  initialExpense,
  defaultHostelId,
  defaultHostelLabel = 'Current hostel',
  onClose,
  onSubmit,
}: {
  categories: string[];
  loading: boolean;
  mode?: 'create' | 'edit';
  initialExpense?: Record<string, any> | null;
  defaultHostelId?: string;
  defaultHostelLabel?: string;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => expenseToForm(initialExpense, defaultHostelId));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showMore, setShowMore] = useState(false);

  const { data: hostelsData } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => import('@features/owners/api').then((m) => m.ownerService.getHostels()),
    staleTime: 10 * 60 * 1000,
    enabled: defaultHostelId === 'all' || !defaultHostelId,
  });

  const hostels: any[] = useMemo(() => {
    return Array.isArray(hostelsData)
      ? hostelsData
      : Array.isArray((hostelsData as any)?.data?.hostels)
        ? (hostelsData as any).data.hostels
        : Array.isArray((hostelsData as any)?.hostels)
          ? (hostelsData as any).hostels
          : [];
  }, [hostelsData]);

  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';
  const categoryOptions = Array.from(new Set([...QUICK_CATEGORIES, ...categories, ...BUSINESS_CATEGORIES]));
  const amountValue = Number(form.amount);
  const isHostelSelected = defaultHostelId !== 'all' || Boolean(form.hostelId);
  const canSave =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(form.title.trim()) &&
    Boolean(form.category) &&
    Boolean(form.payment_method) &&
    Boolean(form.date) &&
    isHostelSelected;

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
      hostelId: form.hostelId || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 pb-3">
          <div className="px-4 pt-4">
            <h3 className="text-lg font-bold text-foreground">Add expense</h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit' ? 'Update the business expense details.' : 'Title, amount, category, method, date. Done fast.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="mr-2 mt-2 p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
                    }))
                  }
                  className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {(defaultHostelId === 'all' || !defaultHostelId) && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hostel *
              </label>
              <select
                value={form.hostelId}
                onChange={(e) => setForm((f) => ({ ...f, hostelId: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
              >
                <option value="">-- Select Hostel --</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name ?? h.hostel_name ?? h.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category }));
            }}
            placeholder="Title, e.g. rice purchase or EB bill"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          {suggestion && suggestion !== form.category && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
              className="rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent"
            >
              Use suggested category: {suggestion}
            </button>
          )}

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

          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor optional, e.g. milk supplier"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />

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
              {defaultHostelId && (
                <label className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <span>
                    <span className="block text-sm font-medium text-foreground">Hostel reference</span>
                    <span className="block text-[11px] text-muted-foreground">Optional label for search only.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        hostelId: f.hostelId ? '' : defaultHostelId,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      form.hostelId
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {form.hostelId ? defaultHostelLabel : 'No reference'}
                  </button>
                </label>
              )}
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
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          )}
        </div>

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
                : !form.payment_method
                  ? 'Choose payment method'
                  : `${mode === 'edit' ? 'Update' : 'Save'} ${amountValue > 0 ? `₹${amountValue.toLocaleString('en-IN')}` : 'expense'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function expenseToForm(expense?: Record<string, any> | null, defaultHostelId?: string) {
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
    hostelId: String(expense?.hostel_id || (defaultHostelId !== 'all' ? defaultHostelId : '') || ''),
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
