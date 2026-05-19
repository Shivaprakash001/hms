import { useState, useEffect, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { useUpdateHostelIdentity, useUploadHostelLogo, useRemoveHostelLogo, HostelInfo, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp } from './shared';

interface Local {
  name: string; phone: string; address: string; city: string;
  state: string; pincode: string; gst_number: string;
}

const init = (h?: HostelInfo): Local => ({
  name: h?.name ?? '', phone: h?.phone ?? '', address: h?.address ?? '',
  city: h?.city ?? '', state: h?.state ?? '', pincode: h?.pincode ?? '',
  gst_number: h?.gst_number ?? '',
});

interface Props { hostelId: string; policy?: HostelPolicy; hostel?: HostelInfo }

export function HostelIdentitySection({ hostelId, hostel }: Props) {
  const [local, setLocal] = useState<Local>(() => init(hostel));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostel) return;
    const next = init(hostel);
    setLocal(next);
    snap.current = next;
  }, [hostelId, hostel]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);
  const mutation = useUpdateHostelIdentity(hostelId);
  const logoMutation = useUploadHostelLogo(hostelId);
  const removeLogoMutation = useRemoveHostelLogo(hostelId);

  const save = () => {
    setError(null);
    mutation.mutate(local, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = (k: keyof Local, v: string) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <SectionShell
      title="Hostel Identity"
      description="Used on receipts, invitation emails, and tenant portal"
      isDirty={isDirty}
      saving={mutation.isPending}
      onSave={save}
      onReset={() => { setLocal(snap.current); setError(null); }}
      error={error}
    >
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
          {hostel?.logo_url ? (
            <img src={hostel.logo_url} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">{(hostel?.name ?? 'H')[0].toUpperCase()}</span>
          )}
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs text-accent font-medium cursor-pointer hover:underline">
            <Upload className="w-3.5 h-3.5" />
            {logoMutation.isPending ? 'Uploading…' : 'Upload logo'}
            <input type="file" accept="image/*" className="sr-only" onChange={e => {
              if (e.target.files?.[0]) logoMutation.mutate(e.target.files[0]);
            }} />
          </label>
          {hostel?.logo_url && (
            <button
              onClick={() => removeLogoMutation.mutate()}
              disabled={removeLogoMutation.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> {removeLogoMutation.isPending ? 'Removing…' : 'Remove'}
            </button>
          )}
          <p className="text-xs text-muted-foreground">PNG / JPG, max 2 MB</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Hostel name">
          <input className={inp} value={local.name} onChange={e => upd('name', e.target.value)} placeholder="My Hostel" />
        </Field>
        <Field label="Phone">
          <input className={inp} value={local.phone} onChange={e => upd('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
        </Field>
        <Field label="Address" >
          <input className={inp} value={local.address} onChange={e => upd('address', e.target.value)} placeholder="Street address" />
        </Field>
        <Field label="City">
          <input className={inp} value={local.city} onChange={e => upd('city', e.target.value)} placeholder="Bangalore" />
        </Field>
        <Field label="State">
          <input className={inp} value={local.state} onChange={e => upd('state', e.target.value)} placeholder="Karnataka" />
        </Field>
        <Field label="Pincode">
          <input className={inp} value={local.pincode} onChange={e => upd('pincode', e.target.value)} placeholder="560001" />
        </Field>
        <Field label="GST number" hint="Optional — printed on receipts">
          <input className={inp} value={local.gst_number} onChange={e => upd('gst_number', e.target.value)} placeholder="27XXXXX..." />
        </Field>
      </div>
    </SectionShell>
  );
}
