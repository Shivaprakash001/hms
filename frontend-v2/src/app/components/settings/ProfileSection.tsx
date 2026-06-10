import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerService } from '@features/owners/api';
import { useUpdateOwnerProfile } from '@features/settings/settingsHooks';
import { SectionShell, Field, inp } from './shared';
import { useAuth } from '@context/AuthContext';
import { tenantService } from '@features/tenants/api';
import { CheckCircle2 } from 'lucide-react';

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

  // OTP States for Primary Phone
  const [otpSent1, setOtpSent1] = useState(false);
  const [otpSending1, setOtpSending1] = useState(false);
  const [otpCountdown1, setOtpCountdown1] = useState(0);
  const [otp1, setOtp1] = useState('');
  const [otpVerified1, setOtpVerified1] = useState(false);
  const [verifiedPhone1, setVerifiedPhone1] = useState('');
  const [otpVerifying1, setOtpVerifying1] = useState(false);

  // OTP States for Emergency Contact Phone
  const [otpSent2, setOtpSent2] = useState(false);
  const [otpSending2, setOtpSending2] = useState(false);
  const [otpCountdown2, setOtpCountdown2] = useState(0);
  const [otp2, setOtp2] = useState('');
  const [otpVerified2, setOtpVerified2] = useState(false);
  const [verifiedPhone2, setVerifiedPhone2] = useState('');
  const [otpVerifying2, setOtpVerifying2] = useState(false);

  // Phone 1 countdown
  useEffect(() => {
    if (otpCountdown1 <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown1((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown1]);

  // Phone 2 countdown
  useEffect(() => {
    if (otpCountdown2 <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown2((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown2]);

  const resetVerification = () => {
    setOtpSent1(false);
    setOtp1('');
    setOtpVerified1(false);
    setVerifiedPhone1('');
    setOtpCountdown1(0);

    setOtpSent2(false);
    setOtp2('');
    setOtpVerified2(false);
    setVerifiedPhone2('');
    setOtpCountdown2(0);
  };

  useEffect(() => {
    if (owner?.id) {
      const next = init(raw);
      setLocal(next);
      snap.current = next;
      resetVerification();
    }
  }, [owner?.id, raw]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);
  const mutation = useUpdateOwnerProfile();

  const handleSendOtp = async (phone: string, purpose: string, countdownSetter: any, sentSetter: any, sendingSetter: any) => {
    const numericPhone = digits(phone);
    if (numericPhone.length < 10) {
      toast.error('Please enter a valid mobile number.');
      return;
    }
    sendingSetter(true);
    try {
      await tenantService.sendPhoneOtp({ phone: numericPhone, purpose });
      sentSetter(true);
      countdownSetter(60);
      toast.success('Verification code sent successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Could not send verification code');
    } finally {
      sendingSetter(false);
    }
  };

  const handleVerifyOtp = async (phone: string, otp: string, purpose: string, verifiedSetter: any, verifiedPhoneSetter: any, verifyingSetter: any) => {
    const numericPhone = digits(phone);
    if (numericPhone.length < 10) {
      toast.error('Please enter a valid mobile number.');
      return;
    }
    if (otp.length < 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }
    verifyingSetter(true);
    try {
      await tenantService.verifyPhoneOtp({ phone: numericPhone, otp, purpose });
      verifiedSetter(true);
      verifiedPhoneSetter(numericPhone);
      toast.success('Mobile number verified successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Verification failed. Invalid or expired code.');
    } finally {
      verifyingSetter(false);
    }
  };

  const save = () => {
    setError(null);
    const name = local.name.trim();
    if (name.length < 2) {
      setError('Full name must be at least 2 characters');
      return;
    }

    const p1 = digits(local.phone);
    const p2 = digits(local.emergency_contact);

    if (p1 !== digits(snap.current.phone) && (!otpVerified1 || p1 !== verifiedPhone1)) {
      toast.error('Please verify your primary mobile number first.');
      return;
    }
    if (p2 !== digits(snap.current.emergency_contact) && (!otpVerified2 || p2 !== verifiedPhone2)) {
      toast.error('Please verify the emergency contact mobile number first.');
      return;
    }

    if (p1 && p1 === p2) {
      toast.error('Primary and Emergency phone numbers cannot be the same.');
      return;
    }

    mutation.mutate({
      name,
      phone: p1,
      address: local.address.trim(),
      city: local.city.trim(),
      state: local.state.trim(),
      pincode: digits(local.pincode),
      emergency_contact: p2,
      phone_otp: p1 !== digits(snap.current.phone) ? otp1 : undefined,
      emergency_otp: p2 !== digits(snap.current.emergency_contact) ? otp2 : undefined,
    }, {
      onSuccess: (result: any) => {
        const next = init(result);
        setLocal(next);
        snap.current = next;
        resetVerification();
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
      onReset={() => { setLocal(snap.current); resetVerification(); setError(null); }}
      error={error}
    >
      <Field label="Full name">
        <input className={inp} value={local.name} onChange={e => upd('name', e.target.value)} placeholder="Your name" />
      </Field>
      <Field label="Phone">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className={`${inp} pr-24`}
                value={local.phone}
                onChange={e => upd('phone', phoneInput(e.target.value))}
                placeholder="+91 XXXXX XXXXX"
                inputMode="tel"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {digits(local.phone) === digits(snap.current.phone) ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Current
                  </span>
                ) : (otpVerified1 && digits(local.phone) === verifiedPhone1) ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md animate-pulse">
                    Required
                  </span>
                )}
              </div>
            </div>
            {digits(local.phone) !== digits(snap.current.phone) && !(otpVerified1 && digits(local.phone) === verifiedPhone1) && digits(local.phone).length >= 10 && (
              <button
                type="button"
                disabled={otpSending1 || (otpCountdown1 > 0)}
                onClick={() => handleSendOtp(local.phone, 'ProfileUpdate', setOtpCountdown1, setOtpSent1, setOtpSending1)}
                className="px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                {otpSending1 ? 'Sending...' : otpCountdown1 > 0 ? `Resend in ${otpCountdown1}s` : otpSent1 ? 'Resend code' : 'Send Code'}
              </button>
            )}
          </div>
          {!otpVerified1 && digits(local.phone) !== digits(snap.current.phone) && otpSent1 && (
            <div className="flex gap-2 max-w-sm">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp1}
                onChange={(e) => setOtp1(digits(e.target.value))}
                placeholder="Enter 6-digit code"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm flex-1 tracking-widest text-center font-bold"
              />
              <button
                type="button"
                disabled={otpVerifying1 || otp1.length < 6}
                onClick={() => handleVerifyOtp(local.phone, otp1, 'ProfileUpdate', setOtpVerified1, setVerifiedPhone1, setOtpVerifying1)}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                {otpVerifying1 ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          )}
        </div>
      </Field>
      <Field label="Emergency contact">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className={`${inp} pr-24`}
                value={local.emergency_contact}
                onChange={e => upd('emergency_contact', phoneInput(e.target.value))}
                placeholder="+91 XXXXX XXXXX"
                inputMode="tel"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {digits(local.emergency_contact) === digits(snap.current.emergency_contact) ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Current
                  </span>
                ) : (otpVerified2 && digits(local.emergency_contact) === verifiedPhone2) ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md animate-pulse">
                    Required
                  </span>
                )}
              </div>
            </div>
            {digits(local.emergency_contact) !== digits(snap.current.emergency_contact) && !(otpVerified2 && digits(local.emergency_contact) === verifiedPhone2) && digits(local.emergency_contact).length >= 10 && (
              <button
                type="button"
                disabled={otpSending2 || (otpCountdown2 > 0)}
                onClick={() => handleSendOtp(local.emergency_contact, 'ProfileUpdate', setOtpCountdown2, setOtpSent2, setOtpSending2)}
                className="px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                {otpSending2 ? 'Sending...' : otpCountdown2 > 0 ? `Resend in ${otpCountdown2}s` : otpSent2 ? 'Resend code' : 'Send Code'}
              </button>
            )}
          </div>
          {!otpVerified2 && digits(local.emergency_contact) !== digits(snap.current.emergency_contact) && otpSent2 && (
            <div className="flex gap-2 max-w-sm">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp2}
                onChange={(e) => setOtp2(digits(e.target.value))}
                placeholder="Enter 6-digit code"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm flex-1 tracking-widest text-center font-bold"
              />
              <button
                type="button"
                disabled={otpVerifying2 || otp2.length < 6}
                onClick={() => handleVerifyOtp(local.emergency_contact, otp2, 'ProfileUpdate', setOtpVerified2, setVerifiedPhone2, setOtpVerifying2)}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                {otpVerifying2 ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          )}
        </div>
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
