import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { normalizeIndianPhone } from '@/lib/phone';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authService } from '../../api/services';

export default function PhoneOtpVerification({ phone, onVerified, disabled = false }) {
    const [otp, setOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [verifiedPhone, setVerifiedPhone] = useState('');
    const [hasSentOnce, setHasSentOnce] = useState(false);

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

    const sendOtp = async () => {
        setError('');
        setStatus('');
        
        if (!normalizedPhone) {
            setError('Enter a valid Indian mobile number.');
            return;
        }

        setSending(true);
        try {
            await authService.sendOtp(normalizedPhone);
            setCountdown(60);
            setStatus(`OTP sent to ${normalizedPhone}`);
            setHasSentOnce(true);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Unable to send OTP. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const verifyOtp = async () => {
        setError('');
        if (!hasSentOnce) {
            setError('Please send OTP first.');
            return;
        }
        if (!/^\d{4,6}$/.test(otp.trim())) {
            setError('Enter a valid OTP.');
            return;
        }

        setVerifying(true);
        try {
            const response = await authService.verifyOtp(normalizedPhone, otp.trim());
            
            setVerifiedPhone(normalizedPhone);
            setStatus('Mobile number verified successfully.');
            // onVerified now returns the verification_token from the backend
            onVerified?.({ 
                verificationToken: response.verification_token, 
                phone: normalizedPhone 
            });
        } catch (err) {
            setError(err?.response?.data?.message || 'Invalid OTP. Please check and try again.');
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
                             hasSentOnce ? <><RotateCcw className="w-4 h-4 mr-2" />Resend OTP</> : 
                             'Send OTP'}
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Input 
                            value={otp} 
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                            placeholder="Enter OTP" 
                            className="h-11 rounded-xl bg-white flex-1" 
                            inputMode="numeric" 
                            disabled={disabled || verifying || !hasSentOnce} 
                        />
                        <Button 
                            type="button" 
                            onClick={verifyOtp} 
                            disabled={disabled || verifying || !hasSentOnce || otp.length < 4} 
                            className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all disabled:opacity-50"
                        >
                            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </Button>
                    </div>
                </div>
            )}

            {status && <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide px-1">{status}</p>}
            {error && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide px-1">{error}</p>}
        </div>
    );
}
