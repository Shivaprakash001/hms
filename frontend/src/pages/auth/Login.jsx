import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, KeyRound, ArrowRight, Chrome } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    const { login, loginWithGoogle } = useAuth();
    const [error, setError] = useState('');

    const navigateForUser = (user) => {
        const role = (user?.role || '').toLowerCase();
        if (role === 'owner' || role === 'admin') {
            navigate('/owner/dashboard');
        } else if (role === 'tenant') {
            if (!user.is_profile_completed) {
                navigate('/complete-profile', { replace: true });
            } else {
                navigate('/tenant/dashboard');
            }
        }
    };

    const loginGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsLoading(true);
            setError('');
            try {
                if (!tokenResponse?.code) throw new Error('Google did not return an authorization code.');
                const redirectUri = window.location.origin;
                const user = await loginWithGoogle(tokenResponse.code, redirectUri);
                navigateForUser(user);
            } catch (err) {
                setError(err.message || 'Google authentication failed');
            } finally {
                setIsLoading(false);
            }
        },
        onError: () => setError('Google authentication failed. Please try again.'),
        flow: 'auth-code',
        ux_mode: 'popup',
        scope: 'openid email profile',
    });

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const user = await login(email, password);
            navigateForUser(user);
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-brand-gradient rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-purple-200 transform rotate-3">
                            <span className="text-white text-3xl font-black">H</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Welcome Back</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center">
                            Manage your property with ease
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-6 border border-rose-100 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleLogin}>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                <Input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com" 
                                    className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-purple-100 transition-all text-base font-medium"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                                <button type="button" className="text-[10px] font-bold text-purple-600 uppercase tracking-widest hover:underline">
                                    Forgot?
                                </button>
                            </div>
                            <div className="relative group">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                <Input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" 
                                    className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-purple-100 transition-all text-base font-medium"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <Button 
                            disabled={isLoading}
                            className="w-full h-14 bg-brand-gradient hover:opacity-90 text-white rounded-2xl font-black text-lg transition-all duration-300 shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group mt-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    Login
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-100"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.2em]">
                                <span className="bg-white px-4 text-slate-400">Or continue with</span>
                            </div>
                        </div>

                        <Button 
                            type="button"
                            variant="outline" 
                            onClick={() => loginGoogle()}
                            disabled={isLoading}
                            className="w-full h-14 border-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Chrome className="w-5 h-5" />
                            Google
                        </Button>
                    </form>

                    <p className="mt-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                        New here?{' '}
                        <Link to="/register" className="text-purple-600 hover:underline">
                            Create account
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
