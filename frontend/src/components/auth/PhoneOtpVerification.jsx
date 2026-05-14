import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth, isFirebasePhoneAuthConfigured } from '@/lib/firebase';
import { normalizeIndianPhone } from '@/lib/phone';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function PhoneOtpVerification({ phone, onVerified, disabled = false }) {
    const recaptchaIdRef = useRef(`recaptcha-${Math.random().toString(36).slice(2)}`);
    const verifierRef = useRef(null);
    const confirmationRef = useRef(null);
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [verifiedPhone, setVerifiedPhone] = useState('');

    const normalizedPhone = useMemo(() => normalizeIndianPhone(phone), [phone]);
    const isVerified = Boolean(verifiedPhone && verifiedPhone === normalizedPhone);

    useEffect(() => {
        if (verifiedPhone && verifiedPhone !== normalizedPhone) {
            setVerifiedPhone('');
            onVerified?.(null);
        }
    }, [normalizedPhone, onVerified, verifiedPhone]);

    useEffect(() => {
        if (countdown <= 0) return undefined;
        const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown]);

    useEffect(() => () => {
        verifierRef.current?.clear?.();
        verifierRef.current = null;
    }, []);

    const getVerifier = () => {
        if (!firebaseAuth) throw new Error('Firebase phone auth is not configured.');
        if (!verifierRef.current) {
            verifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaIdRef.current, {
                size: 'invisible',
            });
        }
        return verifierRef.current;
    };

    const sendOtp = async () => {
        setError('');
        setStatus('');
        if (!isFirebasePhoneAuthConfigured) {
            setError('Firebase phone authentication is not configured.');
            return;
        }
        if (!normalizedPhone) {
            setError('Enter a valid Indian mobile number.');
            return;
        }
        setSending(true);
        try {
            confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, getVerifier());
            setCountdown(60);
            setStatus(`OTP sent to ${normalizedPhone}`);
        } catch (err) {
            verifierRef.current?.clear?.();
            verifierRef.current = null;
            setError(err?.message || 'Unable to send OTP. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const verifyOtp = async () => {
        setError('');
        if (!confirmationRef.current) {
            setError('Please send OTP first.');
            return;
        }
        if (!/^\d{6}$/.test(otp.trim())) {
            setError('Enter the 6-digit OTP.');
            return;
        }
        setVerifying(true);
        try {
            const result = await confirmationRef.current.confirm(otp.trim());
            const idToken = await result.user.getIdToken(true);
            const verified = result.user.phoneNumber;
            if (verified !== normalizedPhone) {
                throw new Error('Verified phone does not match entered phone.');
            }
            setVerifiedPhone(verified);
            setStatus('Mobile number verified successfully.');
            onVerified?.({ idToken, phone: verified });
        } catch (err) {
            setError(err?.code === 'auth/invalid-verification-code' ? 'Invalid OTP. Please check and try again.' : err?.message || 'OTP verification failed.');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                {isVerified ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldCheck className="w-5 h-5 text-purple-600" />}
                Mobile OTP Verification
            </div>
            <div id={recaptchaIdRef.current} />
            {!isVerified && (
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" onClick={sendOtp} disabled={disabled || sending || !normalizedPhone || countdown > 0} className="h-11 rounded-xl font-bold">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : countdown > 0 ? `Resend in ${countdown}s` : confirmationRef.current ? <><RotateCcw className="w-4 h-4 mr-2" />Resend OTP</> : 'Send OTP'}
                    </Button>
                    <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter OTP" className="h-11 rounded-xl bg-white" inputMode="numeric" disabled={disabled || verifying} />
                    <Button type="button" onClick={verifyOtp} disabled={disabled || verifying || !confirmationRef.current} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </Button>
                </div>
            )}
            {status && <p className="text-xs font-bold text-emerald-600">{status}</p>}
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        </div>
    );
}
