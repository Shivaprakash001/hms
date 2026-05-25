import { useState } from 'react';
import { Upload, X } from 'lucide-react';

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
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const suggestion = form.title ? suggestExpenseCategory(form.title) : '';

  const submit = () => {
    if (!form.title.trim() || !Number(form.amount) || !form.category || !form.date) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      category: form.category,
      notes: form.notes.trim() || undefined,
      vendor_name: form.vendor_name.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_image: receiptFile || undefined,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : undefined,
      expense_type: ['Internet', 'Security', 'Staff Salary', 'Salary'].includes(form.category) ? 'FIXED' : 'VARIABLE',
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border p-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Add Expense</h3>
            <p className="text-xs text-muted-foreground">Fast entry for daily operations</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, category: f.category === 'Miscellaneous' ? suggestExpenseCategory(title) : f.category }));
            }}
            placeholder="Title, e.g. EB Bill"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          {suggestion && (
            <button
              onClick={() => setForm((f) => ({ ...f, category: suggestion }))}
              className="text-[10px] font-semibold text-accent"
            >
              Suggested category: {suggestion}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Amount"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              placeholder="Payment method"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
            />
          </div>
          <input
            value={form.vendor_name}
            onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
            placeholder="Vendor name"
            className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            rows={3}
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

        <button
          onClick={submit}
          disabled={loading || !form.title.trim() || !Number(form.amount)}
          className="mt-5 w-full py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </div>
    </div>
  );
}

function suggestExpenseCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal)/.test(text)) return 'Food';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter)/.test(text)) return 'Repairs';
  if (/(clean|housekeep)/.test(text)) return 'Cleaning';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(water|tanker)/.test(text)) return 'Water';
  return 'Miscellaneous';
}

