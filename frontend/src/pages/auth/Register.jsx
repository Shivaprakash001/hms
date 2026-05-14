import { useState } from 'react';
import { User, Mail, Phone, KeyRound, Lock, ArrowRight, Loader2, Chrome, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const PW_RULES = [
    { label: '8+ characters',        test: v => v.length >= 8 },
    { label: 'Uppercase letter',     test: v => /[A-Z]/.test(v) },
    { label: 'Number',               test: v => /[0-9]/.test(v) },
    { label: 'Special character',    test: v => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

const Register = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { loginWithGoogle } = useAuth();
    const [showPw, setShowPw] = useState(false);

    const [formData, setFormData] = useState({
        name:            '',
        email:           '',
        phone:           '',
        password:        '',
        confirmPassword: '',
        role:            'admin',
    });

    const googleSignup = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsLoading(true);
            setError('');
            try {
                if (!tokenResponse?.code) throw new Error('Google did not return an authorization code.');
                await loginWithGoogle(tokenResponse.code, window.location.origin);
                setStoredStep('ACCOUNT_CREATED');
                navigate('/onboarding/welcome');
            } catch (err) {
                setError(err.message || 'Google signup failed');
            } finally {
                setIsLoading(false);
            }
        },
        onError: () => setError('Google signup failed'),
        flow: 'auth-code',
        ux_mode: 'popup',
        scope: 'openid email profile',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Clean phone number input to digits only if it's the phone field
        if (name === 'phone') {
            const cleaned = value.replace(/\D/g, '').slice(0, 10);
            setFormData(p => ({ ...p, [name]: cleaned }));
        } else {
            setFormData(p => ({ ...p, [name]: value }));
        }
    };

    const validate = () => {
        if (!formData.name.trim())  return 'Enter your full name';
        if (!formData.email.trim()) return 'Enter your email';
        if (!formData.phone.trim() || formData.phone.length !== 10) return 'Enter a valid 10-digit phone number';
        for (const rule of PW_RULES) {
            if (!rule.test(formData.password)) return `Password: ${rule.label.toLowerCase()} needed`;
        }
        if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
        return null;
    };

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        setError('');
        
        const validationErr = validate();
        if (validationErr) { 
            setError(validationErr); 
            return; 
        }

        setIsLoading(true);
        try {
            console.log("Submitting registration...", formData);
            await authService.register(formData);
            setSuccess(true);
            setStoredStep('ACCOUNT_CREATED');
            setTimeout(() => navigate('/onboarding/welcome'), 2000);
        } catch (err) {
            console.error("Registration error details:", err.response?.data);
            const serverMsg = err?.response?.data?.detail || err?.response?.data?.message || 'Registration failed';
            setError(serverMsg);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 text-center max-w-md w-full"
                >
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-50">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Account Created! 🎉</h2>
                    <p className="text-slate-500 font-medium mb-8">Launching your onboarding experience…</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2 }}
                            className="bg-brand-gradient h-full rounded-full"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    const strength = PW_RULES.filter(r => r.test(formData.password)).length;

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-xl z-10"
            >
                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
                    <div className="flex flex-col items-center mb-10 text-center">
                        <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-purple-200">
                            <span className="text-white text-2xl font-black">H</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Create Account</h1>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Start your property management journey</p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-6 border border-rose-100 flex items-center gap-3 overflow-hidden"
                            >
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                    <Input 
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="John Doe" 
                                        className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50/50"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                    <Input 
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="10-digit number" 
                                        className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50/50"
                                        required
                                        type="tel"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                <Input 
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@company.com" 
                                    className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50/50"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                    <Input 
                                        name="password"
                                        type={showPw ? "text" : "password"} 
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••" 
                                        className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50/50"
                                        required
                                    />
                                </div>
                                <div className="flex gap-1 h-1 mt-1 px-1">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className={`h-full flex-1 rounded-full ${i <= strength ? 'bg-purple-500' : 'bg-slate-100'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                    <Input 
                                        name="confirmPassword"
                                        type="password" 
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••" 
                                        className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50/50"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-14 bg-brand-gradient hover:opacity-90 text-white rounded-2xl font-black text-lg transition-all duration-300 shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group mt-4"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
                        </Button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                            <div className="relative flex justify-center"><span className="bg-white px-4 text-[10px] font-black uppercase tracking-widest text-slate-300">Or signup with</span></div>
                        </div>

                        <Button 
                            type="button"
                            variant="outline" 
                            onClick={() => googleSignup()}
                            disabled={isLoading}
                            className="w-full h-14 border-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Chrome className="w-5 h-5" />
                            Sign up with Google
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-purple-600 hover:underline">Login</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
