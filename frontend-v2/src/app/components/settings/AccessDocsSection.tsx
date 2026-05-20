import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Toggle, FieldRow, Field, inp } from './shared';

interface Local {
  allow_profile_edits: boolean; profile_photo_required: boolean;
  prefix: string; receipt_footer: string; auto_email_receipt: boolean;
  currency: string; timezone: string; date_format: string; time_format: string;
}

const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ Indian Rupee (INR)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
];
const TZ_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'IST — Asia/Kolkata' },
  { value: 'Asia/Dubai', label: 'GST — Asia/Dubai' },
  { value: 'UTC', label: 'UTC' },
];
const DATE_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const init = (p?: HostelPolicy): Local => ({
  allow_profile_edits: p?.tenant_rules.allow_profile_edits ?? true,
  profile_photo_required: p?.tenant_rules.profile_photo_required ?? false,
  prefix: p?.receipts.prefix ?? 'SAH',
  receipt_footer: p?.receipts.footer ?? '',
  auto_email_receipt: p?.receipts.auto_email ?? false,
  currency: p?.operations.currency ?? 'INR',
  timezone: p?.operations.timezone ?? 'Asia/Kolkata',
  date_format: p?.operations.date_format ?? 'DD/MM/YYYY',
  time_format: p?.operations.time_format ?? '12h',
});

interface Props { hostelId: string; policy?: HostelPolicy }

export function AccessDocsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (!policy) return;
    const next = init(policy); setLocal(next); snap.current = next;
  }, [hostelId, policy]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    mutation.mutate({
      tenant_rules: { allow_profile_edits: local.allow_profile_edits, profile_photo_required: local.profile_photo_required },
      receipts: { prefix: local.prefix, footer: local.receipt_footer, auto_email: local.auto_email_receipt },
      automation: { auto_email_receipts: local.auto_email_receipt },
      operations: { currency: local.currency, timezone: local.timezone, date_format: local.date_format, time_format: local.time_format },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Access & Receipts"
      description="Tenant permissions, receipt formatting, and regional settings"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* Tenant access */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tenant permissions</p>
        <FieldRow label="Allow profile edits" hint="Tenants can update their own profile info">
          <Toggle checked={local.allow_profile_edits} onChange={v => upd('allow_profile_edits', v)} />
        </FieldRow>
        <FieldRow label="Require profile photo" hint="Tenants must upload a photo to complete onboarding">
          <Toggle checked={local.profile_photo_required} onChange={v => upd('profile_photo_required', v)} />
        </FieldRow>
      </div>

      {/* Receipts */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receipts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Receipt number prefix" hint={`Preview: ${local.prefix}-2025-0001`}>
            <input className={inp} maxLength={10} value={local.prefix}
              onChange={e => upd('prefix', e.target.value.toUpperCase())} placeholder="SAH" />
          </Field>
        </div>
        <Field label="Receipt footer text" hint="Printed at the bottom of every receipt">
          <textarea rows={2} className={`${inp} resize-none`} value={local.receipt_footer}
            onChange={e => upd('receipt_footer', e.target.value)}
            placeholder="Thank you for staying with us" />
        </Field>
        <FieldRow label="Auto-email receipts" hint="Email receipt to tenant when payment is recorded">
          <Toggle checked={local.auto_email_receipt} onChange={v => upd('auto_email_receipt', v)} />
        </FieldRow>
      </div>

      {/* Regional */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Regional settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Currency">
            <select className={inp} value={local.currency} onChange={e => upd('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select className={inp} value={local.timezone} onChange={e => upd('timezone', e.target.value)}>
              {TZ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Date format">
            <select className={inp} value={local.date_format} onChange={e => upd('date_format', e.target.value)}>
              {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Time format">
            <select className={inp} value={local.time_format} onChange={e => upd('time_format', e.target.value)}>
              <option value="12h">12-hour (AM/PM)</option>
              <option value="24h">24-hour</option>
            </select>
          </Field>
        </div>
      </div>
    </SectionShell>
  );
}
