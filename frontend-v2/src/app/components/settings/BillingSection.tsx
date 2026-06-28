import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CalendarRange, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useUpdateHostelPolicy, HostelPolicy, LateFeeRule } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp, Toggle, FieldRow } from './shared';

interface Local {
  auto_rent_day: number;
  due_day: number;
  grace_days: number;
  late_fee_enabled: boolean;
  late_fee_rules: LateFeeRule[];
  max_late_fee: number;
  allowed_frequencies: string[];
  academic_year_start_month: number;
  academic_year_start_day: number;
  academic_year_name_format: string;
  frequency_change_cooldown_days: number;
  minimum_commitment_months: Record<string, number>;
  partial_payments_enabled: boolean;
  partial_min_amount: number;
}

const RULE_TYPE_OPTIONS = [
  { value: 'FLAT', label: 'Flat (₹)' },
  { value: 'PERCENTAGE', label: '% of rent' },
  { value: 'PER_DAY', label: 'Per day (₹)' },
];

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly', hint: 'Every month', always: true },
  { value: 'QUARTERLY', label: 'Quarterly', hint: '3-month grouped' },
  { value: 'HALF_YEARLY', label: 'Half-yearly', hint: '6-month grouped' },
  { value: 'ACADEMIC_YEARLY', label: 'Academic year', hint: 'One bill per cycle' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const init = (p?: HostelPolicy): Local => ({
  auto_rent_day: p?.billing.auto_rent_day ?? 1,
  due_day: p?.billing.due_day ?? 5,
  grace_days: p?.billing.grace_days ?? 0,
  late_fee_enabled: p?.billing.late_fee.enabled ?? false,
  late_fee_rules: p?.billing.late_fee.rules ?? [],
  max_late_fee: p?.billing.late_fee.max_amount ?? 0,
  allowed_frequencies: p?.billing.payment_frequency?.allowed_frequencies ?? ['MONTHLY'],
  academic_year_start_month: p?.billing.payment_frequency?.academic_year_start_month ?? 6,
  academic_year_start_day: p?.billing.payment_frequency?.academic_year_start_day ?? 1,
  academic_year_name_format: p?.billing.payment_frequency?.academic_year_name_format ?? 'YYYY-YYYY',
  frequency_change_cooldown_days: p?.billing.payment_frequency?.frequency_change_cooldown_days ?? 90,
  minimum_commitment_months: p?.billing.payment_frequency?.minimum_commitment_months ?? {
    MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, ACADEMIC_YEARLY: 12, CUSTOM_INSTALLMENTS: 1,
  },
  partial_payments_enabled: p?.billing.partial_payments.enabled ?? false,
  partial_min_amount: p?.billing.partial_payments.minimum_amount ?? 0,
});

/** Compute what the due date would look like for a given month (1-indexed) */
function dueDateForMonth(autoRentDay: number, dueDay: number, referenceMonth = new Date().getMonth() + 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = referenceMonth - 1; // 0-indexed
  if (dueDay >= autoRentDay) {
    // same month
    return new Date(year, month, dueDay);
  }
  // pushed to next month
  return new Date(year, month + 1, dueDay);
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface Props { hostelId: string; policy?: HostelPolicy }

export function BillingSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRent, setPreviewRent] = useState('8000');
  const [previewDays, setPreviewDays] = useState('7');
  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (!policy) return;
    const next = init(policy);
    setLocal(next); snap.current = next;
  }, [hostelId, policy]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    mutation.mutate({
      billing: {
        auto_rent_day: local.auto_rent_day,
        due_day: local.due_day,
        grace_days: local.grace_days,
        late_fee: { enabled: local.late_fee_enabled, rules: local.late_fee_rules, max_amount: local.max_late_fee },
        payment_frequency: {
          allowed_frequencies: local.allowed_frequencies,
          academic_year_start_month: local.academic_year_start_month,
          academic_year_start_day: local.academic_year_start_day,
          academic_year_name_format: local.academic_year_name_format,
          frequency_change_cooldown_days: local.frequency_change_cooldown_days,
          minimum_commitment_months: local.minimum_commitment_months,
        },
        partial_payments: { enabled: local.partial_payments_enabled, minimum_amount: local.partial_min_amount },
      },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  const addRule = () => upd('late_fee_rules', [
    ...local.late_fee_rules,
    { type: 'FLAT', amount: 100, starts_after_days: local.grace_days + 1 },
  ]);
  const removeRule = (i: number) => upd('late_fee_rules', local.late_fee_rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<LateFeeRule>) =>
    upd('late_fee_rules', local.late_fee_rules.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const toggleFrequency = (freq: string) => {
    const exists = local.allowed_frequencies.includes(freq);
    const next = exists
      ? local.allowed_frequencies.filter(f => f !== freq)
      : [...local.allowed_frequencies, freq];
    upd('allowed_frequencies', next.includes('MONTHLY') ? next : ['MONTHLY', ...next]);
  };

  const hasAcademicYearly = local.allowed_frequencies.includes('ACADEMIC_YEARLY');
  const hasMultiPeriod = local.allowed_frequencies.some(f => f !== 'MONTHLY');

  // Live schedule summary
  const generationDay = local.auto_rent_day;
  const dueDay = local.due_day;
  const graceDays = local.grace_days;
  const duePushedToNextMonth = dueDay < generationDay;
  const effectiveDeadlineDay = dueDay + graceDays;
  const feeKicksInDay = effectiveDeadlineDay + 1;

  // Preview calculation
  const previewFee = (() => {
    if (!local.late_fee_enabled || local.late_fee_rules.length === 0) return 0;
    const rent = Number(previewRent) || 0;
    const days = Number(previewDays) || 0;
    const effective = Math.max(days - graceDays, 0);
    let total = 0;
    for (const rule of local.late_fee_rules) {
      if (effective < rule.starts_after_days) continue;
      if (rule.type === 'FLAT') total += rule.amount;
      else if (rule.type === 'PERCENTAGE') total += (rent * rule.amount) / 100;
      else if (rule.type === 'PER_DAY') total += rule.amount * Math.max(0, effective - rule.starts_after_days);
    }
    return local.max_late_fee > 0 ? Math.min(total, local.max_late_fee) : total;
  })();

  return (
    <SectionShell
      title="Rent & Billing"
      description="When rent is generated, when it's due, and how late fees work"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* ── Live billing summary ──────────────────────────────────── */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Current schedule</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Rent generated</p>
            <p className="font-semibold text-foreground">{ordinal(generationDay)} of each month</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment due</p>
            <p className="font-semibold text-foreground">
              {ordinal(dueDay)}{duePushedToNextMonth ? ' (next month)' : ' of same month'}
            </p>
            {duePushedToNextMonth && (
              <p className="text-[10px] text-amber-600 mt-0.5">Due day is before generation day — pushed to next month</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Late fee starts</p>
            <p className="font-semibold text-foreground">
              {graceDays > 0
                ? `Day ${ordinal(feeKicksInDay)} (${graceDays}d grace)`
                : `Immediately after due`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Timing fields ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Timing</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Generation day" hint="Rent is created on this day">
            <input type="number" min={1} max={28} className={inp}
              value={local.auto_rent_day}
              onChange={e => upd('auto_rent_day', Math.min(28, Math.max(1, +e.target.value)))} />
          </Field>
          <Field label="Due day" hint="Payment is due on this day">
            <input type="number" min={1} max={28} className={inp}
              value={local.due_day}
              onChange={e => upd('due_day', Math.min(28, Math.max(1, +e.target.value)))} />
          </Field>
          <Field label="Grace period" hint="Extra days before fees apply">
            <input type="number" min={0} max={30} className={inp}
              value={local.grace_days}
              onChange={e => upd('grace_days', Math.min(30, Math.max(0, +e.target.value)))} />
          </Field>
        </div>
      </div>

      {/* ── Flexible contracts ────────────────────────────────────── */}
      <div>
        <div className="flex items-start gap-2.5 mb-3">
          <CalendarRange className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Flexible billing contracts</p>
            <p className="text-xs text-muted-foreground">Tenants can request these frequencies. Your approval is always required.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FREQUENCY_OPTIONS.map(opt => {
            const checked = local.allowed_frequencies.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border bg-card opacity-70'
                } ${opt.always ? 'cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={opt.always}
                  onChange={() => toggleFrequency(opt.value)}
                  className="mt-0.5 h-4 w-4 accent-accent shrink-0"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Commitment minimums — only show if multi-period is enabled */}
      {hasMultiPeriod && (
        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Minimum commitment (months) before tenant can switch</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FREQUENCY_OPTIONS.filter(o => local.allowed_frequencies.includes(o.value)).map(opt => (
              <Field key={opt.value} label={opt.label}>
                <input type="number" min={0} max={120} className={inp}
                  value={local.minimum_commitment_months[opt.value] ?? 1}
                  onChange={e => upd('minimum_commitment_months', {
                    ...local.minimum_commitment_months,
                    [opt.value]: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                  })} />
              </Field>
            ))}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>Frequency switch requests are blocked until tenant has completed this many months on their current plan.</span>
          </div>
        </div>
      )}

      {/* Academic year config — only show if ACADEMIC_YEARLY is allowed */}
      {hasAcademicYearly && (
        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Academic year settings</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Start month">
              <select
                value={local.academic_year_start_month}
                onChange={e => upd('academic_year_start_month', +e.target.value)}
                className={inp}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </Field>
            <Field label="Start day">
              <input type="number" min={1} max={31} className={inp}
                value={local.academic_year_start_day}
                onChange={e => upd('academic_year_start_day', Math.min(31, Math.max(1, +e.target.value)))} />
            </Field>
            <Field label="Cooldown (days)" hint="Min days before frequency change">
              <input type="number" min={0} max={3650} className={inp}
                value={local.frequency_change_cooldown_days}
                onChange={e => upd('frequency_change_cooldown_days', Math.min(3650, Math.max(0, +e.target.value)))} />
            </Field>
            <Field label="Year label format" hint="e.g. YYYY-YYYY">
              <input className={inp} value={local.academic_year_name_format}
                onChange={e => upd('academic_year_name_format', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Late fees ─────────────────────────────────────────────── */}
      <div className="border-t border-border pt-5 space-y-4">
        <FieldRow label="Enable late fees" hint="Charge tenants for overdue payments">
          <Toggle checked={local.late_fee_enabled} onChange={v => upd('late_fee_enabled', v)} />
        </FieldRow>

        {local.late_fee_enabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Fee rules</p>
                <button type="button" onClick={addRule}
                  className="flex items-center gap-1 text-xs text-accent font-semibold hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add rule
                </button>
              </div>

              {local.late_fee_rules.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">
                  No rules yet — late fees won't accumulate until you add one.
                </p>
              )}

              {local.late_fee_rules.map((rule, i) => (
                <div key={i} className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Type">
                      <select className={inp} value={rule.type}
                        onChange={e => updateRule(i, { type: e.target.value as LateFeeRule['type'] })}>
                        {RULE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label={rule.type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹)'}>
                      <input type="number" min={0} className={inp} value={rule.amount}
                        onChange={e => updateRule(i, { amount: +e.target.value })} />
                    </Field>
                    <div className="flex items-end gap-2">
                      <Field label="Apply after (days overdue)">
                        <input type="number" min={0} className={inp} value={rule.starts_after_days}
                          onChange={e => updateRule(i, { starts_after_days: +e.target.value })} />
                      </Field>
                      <button type="button" onClick={() => removeRule(i)}
                        className="mb-0.5 p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {rule.type === 'FLAT' && `One-time ₹${rule.amount} charge after ${rule.starts_after_days + (graceDays || 0)} days past due (${rule.starts_after_days}d after grace ends)`}
                    {rule.type === 'PER_DAY' && `₹${rule.amount}/day starting ${rule.starts_after_days + (graceDays || 0)} days past due`}
                    {rule.type === 'PERCENTAGE' && `${rule.amount}% of rent charged after ${rule.starts_after_days + (graceDays || 0)} days past due`}
                  </p>
                </div>
              ))}

              {local.late_fee_rules.length > 0 && (
                <Field label="Maximum total late fee (₹)" hint="0 = no cap — fees accumulate without limit">
                  <input type="number" min={0} className={inp} value={local.max_late_fee}
                    onChange={e => upd('max_late_fee', +e.target.value)} />
                </Field>
              )}
            </div>

            {/* Late fee simulator */}
            <div className="rounded-xl border border-border overflow-hidden">
              <button type="button"
                onClick={() => setShowPreview(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-sm font-medium">
                <span>Test late fee calculator</span>
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPreview && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Monthly rent (₹)">
                      <input type="number" className={inp} value={previewRent} onChange={e => setPreviewRent(e.target.value)} />
                    </Field>
                    <Field label="Days overdue (from due date)">
                      <input type="number" min={0} className={inp} value={previewDays} onChange={e => setPreviewDays(e.target.value)} />
                    </Field>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Grace period</span><span>{graceDays} day{graceDays !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Effective overdue days</span>
                      <span>{Math.max(0, (Number(previewDays) || 0) - graceDays)}d</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-border pt-2">
                      <span>Late fee</span>
                      <span className="text-destructive">₹{previewFee.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total payable</span>
                      <span>₹{((Number(previewRent) || 0) + previewFee).toFixed(0)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Estimated — actual amounts calculated by the billing engine at time of charge.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Payment Collection Policy ─────────────────────────── */}
      <div className="border-t border-border pt-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payment Collection Policy
        </p>

        <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
          !local.partial_payments_enabled ? 'border-accent/40 bg-accent/5' : 'border-border bg-card opacity-70'
        }`}>
          <input type="radio" name="payment_policy" checked={!local.partial_payments_enabled}
            onChange={() => upd('partial_payments_enabled', false)}
            className="mt-0.5 h-4 w-4 accent-accent" />
          <span>
            <span className="block text-sm font-medium">Mandatory obligations first</span>
            <span className="block text-xs text-muted-foreground">
              Tenants must pay at least their first group of outstanding obligations in full
              (e.g., Security Deposit + Maintenance before Rent).
            </span>
          </span>
        </label>

        <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
          local.partial_payments_enabled ? 'border-accent/40 bg-accent/5' : 'border-border bg-card opacity-70'
        }`}>
          <input type="radio" name="payment_policy" checked={local.partial_payments_enabled}
            onChange={() => upd('partial_payments_enabled', true)}
            className="mt-0.5 h-4 w-4 accent-accent" />
          <span>
            <span className="block text-sm font-medium">Partial payments allowed</span>
            <span className="block text-xs text-muted-foreground">
              Tenants can pay any amount above the minimum threshold.
            </span>
          </span>
        </label>

        {local.partial_payments_enabled && (
          <Field label="Minimum payment amount (₹)" hint="0 = no minimum">
            <input type="number" min={0} className={inp} value={local.partial_min_amount}
              onChange={e => upd('partial_min_amount', +e.target.value)} />
          </Field>
        )}
      </div>
    </SectionShell>
  );
}
