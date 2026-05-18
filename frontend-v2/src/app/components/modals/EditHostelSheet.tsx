import { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import {
  useHostelPolicy,
  useUpdateHostelIdentity,
  useUploadHostelLogo,
  useRemoveHostelLogo,
} from '@features/settings/settingsHooks';
import { inp, Field } from '../settings/shared';

interface Local {
  name: string; phone: string; address: string;
  city: string; state: string; pincode: string; gst_number: string;
}

function initLocal(h: any): Local {
  return {
    name: h?.name ?? '', phone: h?.phone ?? '',
    address: h?.address ?? '', city: h?.city ?? '',
    state: h?.state ?? '', pincode: h?.pincode ?? '',
    gst_number: h?.gst_number ?? '',
  };
}

interface Props { hostelId: string; hostelName: string; onClose: () => void }

export function EditHostelSheet({ hostelId, hostelName, onClose }: Props) {
  const { data: policyData, isLoading } = useHostelPolicy(hostelId);
  const hostel = policyData?.hostel;

  const [local, setLocal] = useState<Local>(() => initLocal(hostel));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hostel?.id) {
      const next = initLocal(hostel);
      setLocal(next);
      snap.current = next;
    }
  }, [hostel?.id]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const mutation = useUpdateHostelIdentity(hostelId);
  const logoMutation = useUploadHostelLogo(hostelId);
  const removeMutation = useRemoveHostelLogo(hostelId);

  const save = () => {
    setError(null);
    mutation.mutate(local, {
      onSuccess: () => { snap.current = local; },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const reset = () => {
    const next = initLocal(hostel);
    setLocal(next);
    snap.current = next;
    setError(null);
  };

  const upd = (k: keyof Local, v: string) => setLocal(p => ({ ...p, [k]: v }));

  const initials = (local.name || hostelName || 'H')
    .split(' ').map((w: string) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-background rounded-t-2xl md:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-foreground flex-1 truncate">
            {local.name || hostelName || 'Edit Hostel'}
          </h2>
          {isDirty && (
            <span className="text-xs text-amber-500 font-medium shrink-0">Unsaved</span>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 bg-secondary rounded" />
                  <div className="h-10 bg-secondary rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 space-y-7">

              {/* ── Identity ─────────────────────────────── */}
              <section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  Identity
                </p>

                {/* Logo */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {hostel?.logo_url
                      ? <img src={hostel.logo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-lg font-bold text-accent">{initials}</span>
                    }
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-accent cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {logoMutation.isPending ? 'Uploading…' : 'Upload logo'}
                      <input
                        type="file" accept="image/*" className="sr-only"
                        onChange={e => { if (e.target.files?.[0]) logoMutation.mutate(e.target.files[0]); }}
                      />
                    </label>
                    {hostel?.logo_url && (
                      <button
                        onClick={() => removeMutation.mutate()}
                        disabled={removeMutation.isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {removeMutation.isPending ? 'Removing…' : 'Remove logo'}
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG / JPG, max 2 MB</p>
                  </div>
                </div>

                <Field label="Hostel name">
                  <input
                    className={inp} value={local.name}
                    onChange={e => upd('name', e.target.value)}
                    placeholder="e.g. Green Leaf PG" autoFocus
                  />
                </Field>
              </section>

              {/* ── Contact ──────────────────────────────── */}
              <section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  Contact
                </p>
                <Field label="Phone number">
                  <input
                    className={inp} type="tel" value={local.phone}
                    onChange={e => upd('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>
              </section>

              {/* ── Address ──────────────────────────────── */}
              <section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  Address
                </p>
                <div className="space-y-3">
                  <Field label="Street address">
                    <input
                      className={inp} value={local.address}
                      onChange={e => upd('address', e.target.value)}
                      placeholder="123 Jayanagar 4th Block"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City">
                      <input
                        className={inp} value={local.city}
                        onChange={e => upd('city', e.target.value)}
                        placeholder="Bangalore"
                      />
                    </Field>
                    <Field label="State">
                      <input
                        className={inp} value={local.state}
                        onChange={e => upd('state', e.target.value)}
                        placeholder="Karnataka"
                      />
                    </Field>
                  </div>
                  <Field label="Pincode">
                    <input
                      className={inp} type="text" inputMode="numeric" maxLength={6}
                      value={local.pincode}
                      onChange={e => upd('pincode', e.target.value)}
                      placeholder="560041"
                    />
                  </Field>
                </div>
              </section>

              {/* ── Business ─────────────────────────────── */}
              <section>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  Business
                </p>
                <Field label="GST number" hint="Printed on receipts and invoices">
                  <input
                    className={inp} value={local.gst_number}
                    onChange={e => upd('gst_number', e.target.value.toUpperCase())}
                    placeholder="29XXXXX1234X1ZX"
                  />
                </Field>
              </section>

              {error && (
                <div className="px-3 py-2.5 bg-destructive/10 text-destructive text-xs rounded-lg">
                  {error}
                </div>
              )}

              {/* extra bottom padding for footer */}
              <div className="h-2" />
            </div>
          )}
        </div>

        {/* Sticky footer — only when dirty */}
        {isDirty && (
          <div className="shrink-0 px-4 py-4 border-t border-border bg-card">
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-3 text-sm text-muted-foreground border border-border rounded-xl hover:bg-secondary transition-colors"
              >
                Reset
              </button>
              <button
                onClick={save}
                disabled={mutation.isPending}
                className="flex-1 py-3 bg-accent text-accent-foreground text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity active:scale-[0.98]"
              >
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
