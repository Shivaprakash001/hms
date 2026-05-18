import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp, Toggle, FieldRow } from './shared';

interface Local {
  upi_id: string; partial_payments_enabled: boolean; partial_min_amount: number;
  payment_instructions: string;
}

const init = (p?: HostelPolicy): Local => ({
  upi_id: p?.payments.upi_id ?? '',
  partial_payments_enabled: p?.billing.partial_payments.enabled ?? false,
  partial_min_amount: p?.billing.partial_payments.minimum_amount ?? 0,
  payment_instructions: p?.payments.payment_instructions ?? '',
});

interface Props { hostelId: string; policy?: HostelPolicy }

export function PaymentsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [initId, setInitId] = useState(hostelId);
  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (policy && hostelId !== initId) {
      const next = init(policy);
      setLocal(next); snap.current = next; setInitId(hostelId);
    } else if (policy && !snap.current.upi_id && policy.payments.upi_id) {
      const next = init(policy);
      setLocal(next); snap.current = next;
    }
  }, [hostelId, policy]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    mutation.mutate({
      payments: { upi_id: local.upi_id || null, payment_instructions: local.payment_instructions || null },
      billing: { partial_payments: { enabled: local.partial_payments_enabled, minimum_amount: local.partial_min_amount } },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Payments"
      description="Configure collection settings and UPI details"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      <Field label="UPI ID" hint="Shown to tenants on payment pages and receipts">
        <input className={inp} value={local.upi_id} placeholder="yourname@upi"
          onChange={e => upd('upi_id', e.target.value)} />
      </Field>

      <Field label="Payment instructions" hint="Optional note printed on payment links (e.g. bank transfer details)">
        <textarea rows={3} className={`${inp} resize-none`} value={local.payment_instructions}
          placeholder="Optional instructions for tenants…"
          onChange={e => upd('payment_instructions', e.target.value)} />
      </Field>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Partial payments</p>
        <FieldRow label="Allow partial payments" hint="Tenants can pay less than the full amount due">
          <Toggle checked={local.partial_payments_enabled} onChange={v => upd('partial_payments_enabled', v)} />
        </FieldRow>
        {local.partial_payments_enabled && (
          <Field label="Minimum payment amount (₹)" hint="0 = no minimum">
            <input type="number" min={0} className={inp} value={local.partial_min_amount}
              onChange={e => upd('partial_min_amount', +e.target.value)} />
          </Field>
        )}
      </div>

      <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
        Online payment gateway (PhonePe) is managed at the infrastructure level. Contact support to update gateway credentials.
      </div>
    </SectionShell>
  );
}
