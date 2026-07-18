import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Clock, FileText, X, Zap } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@shared/ui';
import { EXPENSE_CATEGORIES, QUICK_PAYMENT_METHODS, suggestCategory } from '@features/expenses/constants';
import { CategoryPicker } from './CategoryPicker';
import { ReceiptPreview } from './ReceiptPreview';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch frequent expense suggestions — also feeds the CategoryPicker's "recently used" section.
  const { data: suggestions = [] } = useQuery({
    queryKey: ['expenses', 'suggestions'],
    queryFn: () => import('@features/expenses/api').then((m) => m.expenseService.getSuggestions()),
    staleTime: 5 * 60 * 1000,
  });

  const suggestion = form.title ? suggestCategory(form.title) : '';
  const categoryOptions = categories?.length ? categories : EXPENSE_CATEGORIES;
  const amountValue = Number(form.amount);
  const canSave =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(form.title.trim()) &&
    Boolean(form.category) &&
    Boolean(form.date);

  const filteredSuggestions = useMemo(() => {
    if (!form.title.trim() || !Array.isArray(suggestions) || suggestions.length === 0) return [];
    const query = form.title.trim().toLowerCase();
    return suggestions.filter((s: any) => String(s.title || '').toLowerCase().includes(query));
  }, [form.title, suggestions]);

  const existingReceiptUrl = String(initialExpense?.receipt_url || '');
  const financialSummary =
    [
      form.status && form.status !== 'paid' ? titleCase(form.status) : form.status === 'paid' ? 'Paid' : null,
      form.payment_method || null,
      form.vendor_name || null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Optional details';
  const receiptSummary = receiptFile ? receiptFile.name : existingReceiptUrl ? '1 attached' : 'None yet';
  const advancedSummary =
    [form.notes.trim() ? 'Notes added' : null, form.is_recurring ? `Recurring · ${form.recurring_frequency}` : null]
      .filter(Boolean)
      .join(' · ') || 'Optional';

  const defaultOpenSections = useMemo(() => {
    const sections: string[] = [];
    if (mode === 'create') sections.push('financial');
    if (!existingReceiptUrl) sections.push('receipt');
    return sections;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySuggestion = (s: any) => {
    setForm((f) => ({
      ...f,
      title: s.title || f.title,
      amount: s.last_amount ? String(s.last_amount) : f.amount,
      category: s.category || f.category,
      payment_method: s.payment_method || f.payment_method,
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
      expense_scope: 'BUSINESS',
      metadata: suggestion && suggestion !== form.category ? { category_suggestion: suggestion } : undefined,
    });
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{mode === 'edit' ? 'Edit expense' : 'Add expense'}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === 'edit' ? 'Update the expense details.' : 'Title → Amount → Category → Save. Fast.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-5">
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

          {/* Basic Information — always visible, matches the fields the backend actually requires */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">Basic Information</p>

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
                    category: f.category === 'Miscellaneous' ? suggestCategory(title) : f.category,
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    className="w-full rounded-2xl border border-border bg-background py-3.5 pl-10 pr-4 text-2xl font-bold outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Category *
                </label>
                <CategoryPicker
                  value={form.category}
                  onChange={(category) => setForm((f) => ({ ...f, category }))}
                  categories={categoryOptions}
                  frequentExpenses={suggestions}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full sm:max-w-[240px] px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
              />
            </div>
          </div>

          {/* Collapsible secondary sections */}
          <Accordion type="multiple" defaultValue={defaultOpenSections} className="space-y-2">
            <AccordionItem value="financial" className="rounded-xl border border-border bg-card px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  <span className="text-sm font-bold text-foreground">Financial Details</span>
                  <span className="max-w-[55%] truncate text-xs text-muted-foreground">{financialSummary}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Vendor
                    </label>
                    <input
                      value={form.vendor_name}
                      onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
                      placeholder="e.g. milk supplier"
                      className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment method <span className="text-muted-foreground/60 normal-case">(optional)</span>
                  </p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {QUICK_PAYMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, payment_method: f.payment_method === method ? '' : method }))}
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                          form.payment_method === method
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="receipt" className="rounded-xl border border-border bg-card px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  <span className="text-sm font-bold text-foreground">Receipt</span>
                  <span className="max-w-[55%] truncate text-xs text-muted-foreground">{receiptSummary}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {receiptFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                    <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{receiptFile.name}</p>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="rounded-lg p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : existingReceiptUrl ? (
                  <ReceiptPreview url={existingReceiptUrl} variant="compact" onReplace={() => fileInputRef.current?.click()} />
                ) : (
                  <label className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-muted/40">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Attach receipt image</p>
                      <p className="text-[11px] text-muted-foreground">Optional · JPG, PNG or WEBP under 4MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="advanced" className="rounded-xl border border-border bg-card px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  <span className="text-sm font-bold text-foreground">Advanced Options</span>
                  <span className="max-w-[55%] truncate text-xs text-muted-foreground">{advancedSummary}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Monthly grocery stock purchase, no receipt available"
                    rows={2}
                    className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none"
                  />
                </div>

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
                    <select
                      value={form.recurring_frequency}
                      onChange={(e) => setForm((f) => ({ ...f, recurring_frequency: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
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
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  };
}
