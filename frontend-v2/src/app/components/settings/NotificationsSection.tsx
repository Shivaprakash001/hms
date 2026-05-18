import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Toggle, FieldRow } from './shared';

interface Local {
  email: boolean; in_app: boolean; whatsapp: boolean;
  before_due_days: number[]; after_due_days: number[];
  auto_stop_after_payment: boolean;
  late_fee_notifications: boolean; owner_daily_summary: boolean;
}

const BEFORE_DUE_OPTIONS = [7, 5, 3, 2, 1];
const AFTER_DUE_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

const init = (p?: HostelPolicy): Local => ({
  email: p?.reminders.channels.email ?? true,
  in_app: p?.reminders.channels.in_app ?? true,
  whatsapp: p?.reminders.channels.whatsapp ?? false,
  before_due_days: p?.reminders.schedule.before_due_days ?? [],
  after_due_days: p?.reminders.schedule.after_due_days ?? [3, 7],
  auto_stop_after_payment: p?.reminders.auto_stop_after_payment ?? true,
  late_fee_notifications: p?.reminders.late_fee_notifications ?? true,
  owner_daily_summary: p?.reminders.owner_daily_summary ?? false,
});

function DayPicker({
  label, options, selected, onChange,
}: { label: string; options: number[]; selected: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) => onChange(
    selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort((a, b) => a - b)
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(d => (
          <button
            key={d}
            onClick={() => toggle(d)}
            className={`w-9 h-9 rounded-full text-xs font-medium transition-colors border ${
              selected.includes(d)
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-muted-foreground hover:border-accent/50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {label.startsWith('Before') ? 'Days before rent is due' : 'Days after rent was due'}
      </p>
    </div>
  );
}

interface Props { hostelId: string; policy?: HostelPolicy }

export function NotificationsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [initId, setInitId] = useState(hostelId);
  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (policy && hostelId !== initId) {
      const next = init(policy); setLocal(next); snap.current = next; setInitId(hostelId);
    } else if (policy && !snap.current.before_due_days) {
      const next = init(policy); setLocal(next); snap.current = next;
    }
  }, [hostelId, policy]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    mutation.mutate({
      reminders: {
        channels: { email: local.email, in_app: local.in_app, whatsapp: local.whatsapp },
        schedule: { before_due_days: local.before_due_days, after_due_days: local.after_due_days },
        auto_stop_after_payment: local.auto_stop_after_payment,
        late_fee_notifications: local.late_fee_notifications,
        owner_daily_summary: local.owner_daily_summary,
      },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Notifications"
      description="Configure reminder channels, schedule, and owner alerts"
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* Channels */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</p>
        <FieldRow label="Email reminders" hint="Send reminder emails to tenants">
          <Toggle checked={local.email} onChange={v => upd('email', v)} />
        </FieldRow>
        <FieldRow label="In-app notifications" hint="Show alerts inside the tenant app">
          <Toggle checked={local.in_app} onChange={v => upd('in_app', v)} />
        </FieldRow>
        <FieldRow label="WhatsApp reminders" hint="Requires WhatsApp integration to be configured">
          <Toggle checked={local.whatsapp} onChange={v => upd('whatsapp', v)} />
        </FieldRow>
      </div>

      {/* Reminder schedule */}
      <div className="border-t border-border pt-4 space-y-4">
        <DayPicker
          label="Before due date (days)"
          options={BEFORE_DUE_OPTIONS}
          selected={local.before_due_days}
          onChange={v => upd('before_due_days', v)}
        />
        <DayPicker
          label="After due date (days)"
          options={AFTER_DUE_OPTIONS}
          selected={local.after_due_days}
          onChange={v => upd('after_due_days', v)}
        />
      </div>

      {/* Behaviour */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Behaviour</p>
        <FieldRow label="Stop reminders after payment" hint="Automatically cancel pending reminders once paid">
          <Toggle checked={local.auto_stop_after_payment} onChange={v => upd('auto_stop_after_payment', v)} />
        </FieldRow>
        <FieldRow label="Late fee applied alert" hint="Notify tenant when a late fee is added">
          <Toggle checked={local.late_fee_notifications} onChange={v => upd('late_fee_notifications', v)} />
        </FieldRow>
        <FieldRow label="Daily collection summary" hint="Owner receives a daily summary email">
          <Toggle checked={local.owner_daily_summary} onChange={v => upd('owner_daily_summary', v)} />
        </FieldRow>
      </div>
    </SectionShell>
  );
}
