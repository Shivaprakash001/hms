import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerService } from '@features/owners/api';
import { useUpdateOwnerProfile } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp } from './shared';
import { useAuth } from '@context/AuthContext';

interface Local {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergency_contact: string;
}

const ownerFromResponse = (raw: any) => (raw?.data ?? raw)?.owner ?? raw?.owner ?? {};

const init = (raw: any): Local => {
  const owner = ownerFromResponse(raw);
  return {
    name: owner?.name ?? owner?.full_name ?? '',
    phone: owner?.phone ?? '',
    address: owner?.address ?? '',
    city: owner?.city ?? '',
    state: owner?.state ?? '',
    pincode: owner?.pincode ?? '',
    emergency_contact: owner?.emergency_contact ?? '',
  };
};

const profileFromResponse = (raw: any) => {
  const data = raw?.data ?? raw;
  return { ...data, owner: ownerFromResponse(raw) };
};

export function ProfileSection() {
  const { updateUser } = useAuth();
  const { data: raw, isLoading } = useQuery({
    queryKey: ['owner', 'profile'],
    queryFn: ownerService.getProfile,
    staleTime: 10 * 60 * 1000,
  });
  const profile = profileFromResponse(raw) as any;
  const owner = profile.owner ?? {};

  const [local, setLocal] = useState<Local>(() => init(raw));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (owner?.id) {
      const next = init(raw);
      setLocal(next);
      snap.current = next;
    }
  }, [owner?.id, raw]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);
  const mutation = useUpdateOwnerProfile();

  const save = () => {
    setError(null);
    const name = local.name.trim();
    if (name.length < 2) {
      setError('Full name must be at least 2 characters');
      return;
    }

    mutation.mutate({
      name,
      phone: digits(local.phone),
      address: local.address.trim(),
      city: local.city.trim(),
      state: local.state.trim(),
      pincode: digits(local.pincode),
      emergency_contact: digits(local.emergency_contact),
    }, {
      onSuccess: (result: any) => {
        const next = init(result);
        setLocal(next);
        snap.current = next;
        const savedOwner = ownerFromResponse(result);
        updateUser({ name: savedOwner?.name ?? next.name });
        toast.success('Profile saved');
      },
      onError: (e: any) => setError(e?.response?.data?.error?.message ?? 'Failed to save'),
    });
  };

  const upd = (k: keyof Local, v: string) => setLocal(p => ({ ...p, [k]: v }));

  if (isLoading) return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
    </div>
  );

  return (
    <SectionShell
      title="My Profile"
      description="Owner identity — applies globally across all hostels"
      isDirty={isDirty}
      saving={mutation.isPending}
      onSave={save}
      onReset={() => { setLocal(snap.current); setError(null); }}
      error={error}
    >
      <Field label="Full name">
        <input className={inp} value={local.name} onChange={e => upd('name', e.target.value)} placeholder="Your name" />
      </Field>
      <Field label="Phone">
        <input className={inp} value={local.phone} onChange={e => upd('phone', phoneInput(e.target.value))} placeholder="+91 XXXXX XXXXX" inputMode="tel" />
      </Field>
      <Field label="Emergency contact">
        <input className={inp} value={local.emergency_contact} onChange={e => upd('emergency_contact', phoneInput(e.target.value))} placeholder="+91 XXXXX XXXXX" inputMode="tel" />
      </Field>
      <Field label="Address">
        <textarea className={`${inp} min-h-24 resize-y`} value={local.address} onChange={e => upd('address', e.target.value)} placeholder="Street, area, landmark" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <input className={inp} value={local.city} onChange={e => upd('city', e.target.value)} placeholder="City" />
        </Field>
        <Field label="State">
          <input className={inp} value={local.state} onChange={e => upd('state', e.target.value)} placeholder="State" />
        </Field>
        <Field label="Pincode">
          <input className={inp} value={local.pincode} onChange={e => upd('pincode', digits(e.target.value).slice(0, 10))} placeholder="Pincode" inputMode="numeric" />
        </Field>
      </div>
      <Field label="Email">
        <input className={`${inp} opacity-60 cursor-not-allowed`} value={owner?.email ?? ''} readOnly />
        <p className="text-xs text-muted-foreground mt-1">Email cannot be changed — contact support</p>
      </Field>
    </SectionShell>
  );
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function phoneInput(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return `+${digits(trimmed).slice(0, 15)}`;
  return digits(trimmed).slice(0, 15);
}
