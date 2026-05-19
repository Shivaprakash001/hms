import { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Toggle, FieldRow } from './shared';

interface Local {
  auto_generate_rent: boolean; auto_apply_late_fees: boolean;
  auto_send_reminders: boolean; auto_email_receipts: boolean;
}

const init = (p?: HostelPolicy): Local => ({
  auto_generate_rent: p?.automation.auto_generate_rent ?? true,
  auto_apply_late_fees: p?.automation.auto_apply_late_fees ?? true,
  auto_send_reminders: p?.automation.auto_send_reminders ?? true,
  auto_email_receipts: p?.automation.auto_email_receipts ?? false,
});

interface Props { hostelId: string; policy?: HostelPolicy }

export function AutomationSection({ hostelId, policy }: Props) {
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
    mutation.mutate({ automation: local, receipts: { auto_email: local.auto_email_receipts } }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Automation"
      description="Control which background workers run automatically. Toggles configure existing engines — no new cron jobs created."
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/10 rounded-lg text-xs text-accent font-medium">
        <Zap className="w-3.5 h-3.5" />
        These toggles configure the existing automation engine workers
      </div>

      <div className="space-y-3">
        <FieldRow label="Auto-generate rent" hint="Create rent obligations on the configured generation day">
          <Toggle checked={local.auto_generate_rent} onChange={v => upd('auto_generate_rent', v)} />
        </FieldRow>
        <FieldRow label="Auto-apply late fees" hint="Apply configured late fee rules after grace period">
          <Toggle checked={local.auto_apply_late_fees} onChange={v => upd('auto_apply_late_fees', v)} />
        </FieldRow>
        <FieldRow label="Auto-send reminders" hint="Run the reminder engine on configured schedule">
          <Toggle checked={local.auto_send_reminders} onChange={v => upd('auto_send_reminders', v)} />
        </FieldRow>
        <FieldRow label="Auto-email receipts" hint="Email receipt to tenant immediately after payment recorded">
          <Toggle checked={local.auto_email_receipts} onChange={v => upd('auto_email_receipts', v)} />
        </FieldRow>
      </div>
    </SectionShell>
  );
}
