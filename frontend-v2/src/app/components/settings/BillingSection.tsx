import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useUpdateHostelPolicy, HostelPolicy, LateFeeRule } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp, Sel, Toggle, FieldRow } from './shared';

interface Local {
  rent_cycle: string; auto_rent_day: number; due_day: number; grace_days: number;
  late_fee_enabled: boolean; late_fee_rules: LateFeeRule[]; max_late_fee: number;
}

const CYCLE_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'FLAT', label: 'Flat amount (₹)' },
  { value: 'PERCENTAGE', label: 'Percentage of rent (%)' },
  { value: 'PER_DAY', label: 'Per day (₹/day)' },
];

const init = (p?: HostelPolicy): Local => ({
  rent_cycle: p?.billing.rent_cycle ?? 'MONTHLY',
  auto_rent_day: p?.billing.auto_rent_day ?? 1,
  due_day: p?.billing.due_day ?? 5,
  grace_days: p?.billing.grace_days ?? 0,
  late_fee_enabled: p?.billing.late_fee.enabled ?? false,
  late_fee_rules: p?.billing.late_fee.rules ?? [],
  max_late_fee: p?.billing.late_fee.max_amount ?? 500,
});

// simple frontend preview — not authoritative, backend is source of truth
function calcPreview(rentAmount: number, daysLate: number, local: Local) {
  if (!local.late_fee_enabled || local.late_fee_rules.length === 0) return 0;
  let total = 0;
  for (const rule of local.late_fee_rules) {
    if (daysLate < rule.starts_after_days) continue;
    if (rule.type === 'FLAT') total += rule.amount;
    else if (rule.type === 'PERCENTAGE') total += (rentAmount * rule.amount) / 100;
    else if (rule.type === 'PER_DAY') total += rule.amount * Math.max(0, daysLate - rule.starts_after_days);
  }
  return local.max_late_fee > 0 ? Math.min(total, local.max_late_fee) : total;
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
        rent_cycle: local.rent_cycle,
        auto_rent_day: local.auto_rent_day,
        due_day: local.due_day,
        grace_days: local.grace_days,
        late_fee: { enabled: local.late_fee_enabled, rules: local.late_fee_rules, max_amount: local.max_late_fee },
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

  const previewFee = calcPreview(Number(previewRent) || 0, Number(previewDays) || 0, local);
  const dueDateLabel = `Day ${local.due_day}`;
  const graceExpiry = local.due_day + local.grace_days;

  return (
    <SectionShell
      title="Rent & Billing"
      description="Rent cycle, due dates, grace periods, and late fee rules"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* Billing cycle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Rent cycle">
          <Sel value={local.rent_cycle} onChange={v => upd('rent_cycle', v)} options={CYCLE_OPTIONS} />
        </Field>
        <Field label="Rent generation day" hint="Day of month rent is created">
          <input type="number" min={1} max={28} className={inp}
            value={local.auto_rent_day}
            onChange={e => upd('auto_rent_day', Math.min(28, Math.max(1, +e.target.value)))} />
        </Field>
        <Field label="Due day" hint="Day of month payment is due">
          <input type="number" min={1} max={28} className={inp}
            value={local.due_day}
            onChange={e => upd('due_day', Math.min(28, Math.max(1, +e.target.value)))} />
        </Field>
        <Field label="Grace period (days)" hint="Extra days before late fees apply">
          <input type="number" min={0} max={30} className={inp}
            value={local.grace_days}
            onChange={e => upd('grace_days', Math.min(30, Math.max(0, +e.target.value)))} />
        </Field>
      </div>

      {/* Late fee toggle */}
      <FieldRow label="Enable late fees" hint="Charge tenants for overdue payments">
        <Toggle checked={local.late_fee_enabled} onChange={v => upd('late_fee_enabled', v)} />
      </FieldRow>

      {/* Late fee rules */}
      {local.late_fee_enabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Fee rules</span>
            <button onClick={addRule} className="flex items-center gap-1 text-xs text-accent font-medium hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add rule
            </button>
          </div>

          {local.late_fee_rules.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No rules defined — late fees will not accumulate.</p>
          )}

          {local.late_fee_rules.map((rule, i) => (
            <div key={i} className="bg-secondary/50 border border-border rounded-lg p-3 grid grid-cols-3 gap-2 items-end">
              <Field label="Type">
                <Sel value={rule.type} onChange={v => updateRule(i, { type: v as LateFeeRule['type'] })} options={RULE_TYPE_OPTIONS} />
              </Field>
              <Field label={rule.type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹)'}>
                <input type="number" min={0} className={inp} value={rule.amount}
                  onChange={e => updateRule(i, { amount: +e.target.value })} />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Starts after (days)">
                  <input type="number" min={0} className={inp} value={rule.starts_after_days}
                    onChange={e => updateRule(i, { starts_after_days: +e.target.value })} />
                </Field>
                <button onClick={() => removeRule(i)} className="mb-0.5 p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <Field label="Max late fee cap (₹)" hint="0 = no cap">
            <input type="number" min={0} className={inp} value={local.max_late_fee}
              onChange={e => upd('max_late_fee', +e.target.value)} />
          </Field>
        </div>
      )}

      {/* Billing preview */}
      {local.late_fee_enabled && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPreview(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-sm font-medium"
          >
            <span>Late fee simulation</span>
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPreview && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rent amount (₹)">
                  <input type="number" className={inp} value={previewRent} onChange={e => setPreviewRent(e.target.value)} />
                </Field>
                <Field label="Days overdue">
                  <input type="number" min={0} className={inp} value={previewDays} onChange={e => setPreviewDays(e.target.value)} />
                </Field>
              </div>
              <div className="bg-secondary rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Due date</span><span>{dueDateLabel} each month</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Grace expires</span><span>Day {graceExpiry}</span></div>
                <div className="flex justify-between font-medium border-t border-border pt-1.5 mt-1.5">
                  <span>Late fee (estimated)</span>
                  <span className="text-destructive">₹{previewFee.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total payable</span>
                  <span>₹{(+(previewRent || 0) + previewFee).toFixed(0)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Simulation only — actual fees calculated by the billing engine.</p>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
