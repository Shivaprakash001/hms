import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownerService } from '@features/owners/api';
import { useUpdateOwnerProfile } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp } from './shared';

interface Local { name: string; phone: string }
const init = (p: any): Local => ({ name: p?.name ?? p?.full_name ?? '', phone: p?.phone ?? '' });

export function ProfileSection() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['owner', 'profile'],
    queryFn: ownerService.getProfile,
    staleTime: 10 * 60 * 1000,
  });
  const profile = (raw?.data ?? raw) as any;

  const [local, setLocal] = useState<Local>(() => init(profile));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      const next = init(profile);
      setLocal(next);
      snap.current = next;
    }
  }, [profile?.id]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);
  const mutation = useUpdateOwnerProfile();

  const save = () => {
    setError(null);
    mutation.mutate({ name: local.name, phone: local.phone }, {
      onSuccess: () => { snap.current = local; },
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
        <input className={inp} value={local.phone} onChange={e => upd('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
      </Field>
      <Field label="Email">
        <input className={`${inp} opacity-60 cursor-not-allowed`} value={profile?.email ?? ''} readOnly />
        <p className="text-xs text-muted-foreground mt-1">Email cannot be changed — contact support</p>
      </Field>
    </SectionShell>
  );
}
