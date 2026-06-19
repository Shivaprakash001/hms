import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp, Sel, Toggle, FieldRow } from './shared';

interface Local {
  deposit_enabled: boolean; deposit_amount: number; deposit_refundable: boolean;
  deposit_calculation_mode: 'FLAT' | 'MONTHS_OF_RENT'; deposit_months: number;
  maintenance_type: string; maintenance_amount: number;
  auto_fill_room_rent: boolean; allow_override: boolean;
  invite_expiry_hours: number;
}

const MAINT_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly (added each cycle)' },
  { value: 'ONE_TIME', label: 'One-time (charged at joining)' },
  { value: 'NONE', label: 'None (no maintenance charge)' },
];

const init = (p?: HostelPolicy): Local => ({
  deposit_enabled: p?.billing.deposit.enabled ?? false,
  deposit_amount: p?.billing.deposit.default_amount ?? 0,
  deposit_refundable: p?.billing.deposit.refundable ?? true,
  deposit_calculation_mode: p?.billing.deposit.calculation_mode ?? 'FLAT',
  deposit_months: p?.billing.deposit.deposit_months ?? 1,
  maintenance_type: p?.billing.maintenance.type ?? 'MONTHLY',
  maintenance_amount: p?.billing.maintenance.amount ?? 0,
  auto_fill_room_rent: p?.billing.invite_defaults.auto_fill_room_rent ?? true,
  allow_override: p?.billing.invite_defaults.allow_override ?? true,
  invite_expiry_hours: p?.tenant_rules.invite_expiry_hours ?? 48,
});

interface Props { hostelId: string; policy?: HostelPolicy }

export function TenantDefaultsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<Local>(() => init(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
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
        deposit: {
          enabled: local.deposit_enabled,
          default_amount: local.deposit_amount,
          refundable: local.deposit_refundable,
          calculation_mode: local.deposit_calculation_mode,
          deposit_months: local.deposit_months,
        },
        maintenance: { type: local.maintenance_type, amount: local.maintenance_amount },
        invite_defaults: { auto_fill_room_rent: local.auto_fill_room_rent, allow_override: local.allow_override },
      },
      tenant_rules: { invite_expiry_hours: local.invite_expiry_hours },
    }, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = <K extends keyof Local>(k: K, v: Local[K]) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Tenant Defaults"
      description="Default values used when creating new invitations. Changes affect future invitations only."
      isDirty={isDirty} saving={mutation.isPending}
      onSave={save} onReset={() => { setLocal(snap.current); setError(null); }} error={error}
    >
      {/* Security deposit */}
      <FieldRow label="Collect security deposit" hint="Charged at move-in">
        <Toggle checked={local.deposit_enabled} onChange={v => upd('deposit_enabled', v)} />
      </FieldRow>
      {local.deposit_enabled && (
        <div className="space-y-4 pl-3 border-l border-border ml-2 my-2">
          {/* Mode Selector */}
          <Field label="Deposit Calculation Mode">
            <div className="flex rounded-md bg-secondary p-1 max-w-xs">
              <button
                type="button"
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
                  local.deposit_calculation_mode === 'FLAT'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => upd('deposit_calculation_mode', 'FLAT')}
              >
                Fixed Amount
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${
                  local.deposit_calculation_mode === 'MONTHS_OF_RENT'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => upd('deposit_calculation_mode', 'MONTHS_OF_RENT')}
              >
                Multiple of Rent
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {local.deposit_calculation_mode === 'FLAT' ? (
              <Field label="Default deposit (₹)" hint="Flat security deposit amount">
                <input type="number" min={0} className={inp} value={local.deposit_amount}
                  onChange={e => upd('deposit_amount', +e.target.value)} />
              </Field>
            ) : (
              <Field label="Number of months rent" hint="Scaled security deposit multiplier">
                <input type="number" min={1} max={12} className={inp} value={local.deposit_months}
                  onChange={e => upd('deposit_months', Math.min(12, Math.max(1, +e.target.value)))} />
              </Field>
            )}
            <Field label="Refundable">
              <div className="flex items-center h-10">
                <Toggle checked={local.deposit_refundable} onChange={v => upd('deposit_refundable', v)} />
                <span className="ml-2 text-sm text-muted-foreground">{local.deposit_refundable ? 'Yes' : 'No'}</span>
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* Maintenance */}
      <div className="space-y-3">
        <Field label="Maintenance charge type">
          <Sel value={local.maintenance_type} onChange={v => upd('maintenance_type', v)} options={MAINT_OPTIONS} />
        </Field>
        {local.maintenance_type !== 'NONE' && (
          <Field label="Default maintenance amount (₹)">
            <input type="number" min={0} className={inp} value={local.maintenance_amount}
              onChange={e => upd('maintenance_amount', +e.target.value)} />
          </Field>
        )}
      </div>

      {/* Invite defaults */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invite behavior</p>
        <FieldRow label="Auto-fill room rent" hint="Pre-fill rent from room's base rent during invite">
          <Toggle checked={local.auto_fill_room_rent} onChange={v => upd('auto_fill_room_rent', v)} />
        </FieldRow>
        <FieldRow label="Allow price override" hint="Owner can edit pricing at invite time">
          <Toggle checked={local.allow_override} onChange={v => upd('allow_override', v)} />
        </FieldRow>
        <Field label="Invitation link expires (hours)" hint="After this the invite token is invalid">
          <input type="number" min={1} max={720} className={inp} value={local.invite_expiry_hours}
            onChange={e => upd('invite_expiry_hours', Math.min(720, Math.max(1, +e.target.value)))} />
        </Field>
      </div>
    </SectionShell>
  );
}
