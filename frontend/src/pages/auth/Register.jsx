import { useState } from 'react';
import { User, Mail, Phone, KeyRound, Lock, ArrowRight, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';
import { useAuth } from '../../context/AuthContext';

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const PW_RULES = [
  { label: '8+ characters',        test: v => v.length >= 8 },
  { label: 'Uppercase letter',     test: v => /[A-Z]/.test(v) },
  { label: 'Lowercase letter',     test: v => /[a-z]/.test(v) },
  { label: 'Number',               test: v => /[0-9]/.test(v) },
  { label: 'Special character',    test: v => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const passed = PW_RULES.filter(r => r.test(password)).length;
  const pct = Math.round((passed / PW_RULES.length) * 100);
  const color = passed < 2 ? 'bg-red-500' : passed < 4 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {PW_RULES.map(r => (
          <span key={r.label} className={`text-[11px] font-medium flex items-center gap-1 ${r.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>{r.test(password) ? '✓' : '·'}</span> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    name:            '',
    email:           '',
    phone:           '',
    password:        '',
    confirmPassword: '',
    role:            'admin',
  });

  const [showPw, setShowPw] = useState(false);

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
        setError(err.message || 'Google signup failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => setError('Google signup failed. Please try again.'),
    flow: 'auth-code',
    ux_mode: 'popup',
    scope: 'openid email profile',
  });

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const getApiError = (err) => {
    const d = err?.response?.data;
    if (d?.error?.message) return d.error.message;
    if (typeof d?.detail === 'string') return d.detail;
    if (Array.isArray(d?.detail)) return d.detail.map(x => x?.msg).filter(Boolean).join(', ') || 'Registration failed';
    return err?.message || 'Registration failed';
  };

  const validate = () => {
    if (!formData.name.trim())  return 'Please enter your full name';
    if (!formData.email.trim()) return 'Please enter your email';
    if (!formData.phone.trim() || !/^\d{10}$/.test(formData.phone.trim()))
      return 'Please enter a valid 10-digit phone number';
    for (const rule of PW_RULES) {
      if (!rule.test(formData.password)) return `Password must include: ${rule.label.toLowerCase()}`;
    }
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      };
      await authService.register(payload);
      setSuccess(true);
      setStoredStep('ACCOUNT_CREATED');
      // Brief success moment, then redirect into onboarding
      setTimeout(() => navigate('/onboarding/welcome'), 1500);
    } catch (err) {
      setError(getApiError(err));
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
          className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Account Created! 🎉</h2>
          <p className="text-slate-500 font-medium mb-6">Setting up your hostel dashboard…</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5 }}
              className="bg-indigo-500 h-full rounded-full"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-[10%] left-[15%] w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-[80px]"
        />
        <motion.div
          animate={{ y: [0, 30, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, delay: 1.5 }}
          className="absolute bottom-[5%] right-[10%] w-[500px] h-[500px] bg-violet-100/40 rounded-full blur-[90px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-slate-100 p-8 rounded-3xl shadow-2xl shadow-slate-200/50 relative overflow-hidden">
          {/* Accent bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl mb-4 shadow-xl shadow-indigo-600/25 text-white"
            >
              <Sparkles className="w-7 h-7" />
            </motion.div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Start managing your hostel
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1.5">
              No credit card. No long forms. Just your hostel, automated.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-5 border border-red-100"
            >
              {error}
            </motion.div>
          )}

          <button
            type="button"
            onClick={() => googleSignup()}
            disabled={isLoading}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-black text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-300">or create with email</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Rajesh Kumar"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Phone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="10-digit mobile"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Password</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <PasswordStrength password={formData.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm ${
                    formData.confirmPassword && formData.confirmPassword !== formData.password
                      ? 'border-red-300'
                      : 'border-slate-100'
                  }`}
                />
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              id="register-submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 text-sm font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 mt-2"
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <> Create My Account <ArrowRight className="h-4 w-4" /></>
              }
            </motion.button>
          </form>

          <div className="mt-7 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-bold transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
