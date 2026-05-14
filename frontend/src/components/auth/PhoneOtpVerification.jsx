import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
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

    const normalizedPhone = useMemo(() => {
        const norm = normalizeIndianPhone(phone);
        console.log('[OTP Debug] Normalizing phone:', { input: phone, output: norm });
        return norm;
    }, [phone]);

    const isVerified = Boolean(verifiedPhone && verifiedPhone === normalizedPhone);

    useEffect(() => {
        if (verifiedPhone && verifiedPhone !== normalizedPhone) {
            console.log('[OTP Debug] Verified phone mismatch, resetting:', { verifiedPhone, normalizedPhone });
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
        console.log('[OTP Debug] Cleaning up reCAPTCHA verifier');
        verifierRef.current?.clear?.();
        verifierRef.current = null;
    }, []);

    const getVerifier = () => {
        console.log('[OTP Debug] Initializing reCAPTCHA verifier...');
        if (!firebaseAuth) {
            console.error('[OTP Debug] firebaseAuth is null! Check firebase.js initialization.');
            throw new Error('Firebase Auth not initialized.');
        }
        
        try {
            if (!verifierRef.current) {
                verifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaIdRef.current, {
                    size: 'invisible',
                    callback: (response) => {
                        console.log('[OTP Debug] reCAPTCHA solved successfully');
                    },
                    'expired-callback': () => {
                        console.warn('[OTP Debug] reCAPTCHA expired, resetting...');
                        verifierRef.current?.reset();
                    }
                });
                console.log('[OTP Debug] reCAPTCHA verifier created');
            }
            return verifierRef.current;
        } catch (err) {
            console.error('[OTP Debug] Failed to create reCAPTCHA verifier:', err);
            throw err;
        }
    };

    const sendOtp = async () => {
        console.log('[OTP Debug] --- START: Sending OTP ---');
        setError('');
        setStatus('');
        
        if (!isFirebasePhoneAuthConfigured) {
            const msg = 'Firebase keys missing in environment variables.';
            console.error('[OTP Debug]', msg);
            setError(msg);
            return;
        }

        if (!normalizedPhone) {
            const msg = 'Invalid phone format. Must be +91 followed by 10 digits.';
            console.error('[OTP Debug]', msg);
            setError(msg);
            return;
        }

        setSending(true);
        try {
            const verifier = getVerifier();
            console.log('[OTP Debug] Calling signInWithPhoneNumber for:', normalizedPhone);
            
            confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, verifier);
            
            console.log('[OTP Debug] OTP Sent Successfully! confirmationResult received.');
            setCountdown(60);
            setStatus(`OTP sent to ${normalizedPhone}`);
        } catch (err) {
            console.error('[OTP Debug] OTP Send Error:', {
                code: err.code,
                message: err.message,
                customData: err.customData
            });
            
            verifierRef.current?.clear?.();
            verifierRef.current = null;
            
            let userMsg = 'Unable to send OTP. ';
            if (err.code === 'auth/invalid-phone-number') userMsg += 'The phone number is invalid.';
            else if (err.code === 'auth/too-many-requests') userMsg += 'Quota exceeded or too many attempts.';
            else if (err.code === 'auth/network-request-failed') userMsg += 'Network error. Check your connection.';
            else userMsg += err.message;
            
            setError(userMsg);
        } finally {
            setSending(false);
            console.log('[OTP Debug] --- END: Sending OTP ---');
        }
    };

    const verifyOtp = async () => {
        console.log('[OTP Debug] --- START: Verifying OTP ---');
        setError('');
        
        if (!confirmationRef.current) {
            setError('Please send OTP first.');
            return;
        }
        
        if (!/^\d{6}$/.test(otp.trim())) {
            setError('Enter a valid 6-digit OTP.');
            return;
        }

        setVerifying(true);
        try {
            console.log('[OTP Debug] Confirming OTP code:', otp.trim());
            const result = await confirmationRef.current.confirm(otp.trim());
            
            console.log('[OTP Debug] Verification Successful! result.user:', result.user.uid);
            const idToken = await result.user.getIdToken(true);
            const verified = result.user.phoneNumber;

            if (verified !== normalizedPhone) {
                console.error('[OTP Debug] Verified phone mismatch!', { verified, expected: normalizedPhone });
                throw new Error('Verified phone does not match entered phone.');
            }

            setVerifiedPhone(verified);
            setStatus('Mobile number verified successfully.');
            onVerified?.({ idToken, phone: verified });
        } catch (err) {
            console.error('[OTP Debug] OTP Verification Error:', {
                code: err.code,
                message: err.message
            });
            setError(err.code === 'auth/invalid-verification-code' ? 'Invalid OTP. Please check and try again.' : err.message);
        } finally {
            setVerifying(false);
            console.log('[OTP Debug] --- END: Verifying OTP ---');
        }
    };

    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                    {isVerified ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldCheck className="w-5 h-5 text-purple-600" />}
                    Mobile OTP Verification
                </div>
                {!isFirebasePhoneAuthConfigured && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 uppercase tracking-tighter">
                        <AlertTriangle className="w-3 h-3" />
                        Config Missing
                    </div>
                )}
            </div>

            <div id={recaptchaIdRef.current} />

            {!isVerified && (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            type="button" 
                            onClick={sendOtp} 
                            disabled={disabled || sending || !normalizedPhone || countdown > 0} 
                            className="h-11 rounded-xl font-bold flex-1"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                             countdown > 0 ? `Resend in ${countdown}s` : 
                             confirmationRef.current ? <><RotateCcw className="w-4 h-4 mr-2" />Resend OTP</> : 
                             'Send OTP'}
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Input 
                            value={otp} 
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                            placeholder="Enter 6-digit OTP" 
                            className="h-11 rounded-xl bg-white flex-1" 
                            inputMode="numeric" 
                            disabled={disabled || verifying || !confirmationRef.current} 
                        />
                        <Button 
                            type="button" 
                            onClick={verifyOtp} 
                            disabled={disabled || verifying || !confirmationRef.current || otp.length < 6} 
                            className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50"
                        >
                            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </Button>
                    </div>
                </div>
            )}

            {status && <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide px-1">{status}</p>}
            {error && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide px-1">{error}</p>}
            
            {/* Developer Hint */}
            {!isFirebasePhoneAuthConfigured && (
                <p className="text-[9px] text-slate-400 leading-tight bg-white p-2 rounded-lg border border-dashed border-slate-200">
                    <span className="font-bold text-slate-900 uppercase">Dev Hint:</span> Ensure VITE_FIREBASE_* keys are in your frontend .env file.
                </p>
            )}
        </div>
    );
}
