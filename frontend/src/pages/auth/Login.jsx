import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Loader2, KeyRound, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const { login } = useAuth();
    const [error, setError] = useState('');

    const onLoginSuccess = () => {
        navigate('/owner/dashboard');
    };

    const loginGoogle = useGoogleLogin({
        onSuccess: tokenResponse => {
            console.log(tokenResponse);
            onLoginSuccess();
        },
        onError: () => {
            console.log('Login Failed');
            alert("Login Failed. Please check console.");
        },
        flow: 'auth-code',
        redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/callback`
    });

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const user = await login(email, password);
            const role = (user?.role || '').toLowerCase();
            if (role === 'owner' || role === 'admin') {
                navigate('/owner/dashboard');
            } else if (role === 'student') {
                navigate('/student/dashboard');
            }
        } catch (err) {
            console.error("Login error:", err);
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Ambient Background - Clean Light Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100" />

            {/* Subtle Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        y: [0, -20, 0],
                        opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[10%] left-[20%] w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[80px]"
                />
                <motion.div
                    animate={{
                        y: [0, 30, 0],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-[90px]"
                />
            </div>

            {/* Login Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-[440px] relative z-10"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-3xl shadow-2xl shadow-slate-200/50 relative overflow-hidden">

                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    {/* Brand Header */}
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-6 shadow-xl shadow-indigo-600/20 text-white transform rotate-3"
                        >
                            <img
                                src="/android-chrome-512x512.png"
                                alt="Trishul Solutions logo"
                                className="w-10 h-10 object-contain"
                                loading="eager"
                                decoding="async"
                            />
                        </motion.div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
                            Trishul <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Solutions</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            Enterprise Management Portal
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium mb-4"
                        >
                            {error}
                        </motion.div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium sm:text-sm hover:bg-white hover:border-slate-300"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                <a href="#" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium sm:text-sm hover:bg-white hover:border-slate-300"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-6"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Sign In <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8 select-none">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wide">
                            <span className="bg-white px-3 py-1 rounded-full text-slate-400 border border-slate-100 font-bold">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    {/* Google Login */}
                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => loginGoogle()}
                        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-200 transition-all"
                    >
                        <GoogleIcon />
                        <span className="text-sm">Sign in with Google</span>
                    </motion.button>

                    {/* Footer Links */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-4">
                        <div className="flex items-center justify-center text-sm text-slate-500 font-medium">
                            Don't have an account?{' '}
                            <Link to="/register" className="ml-1 text-indigo-600 hover:text-indigo-700 font-bold transition-colors">
                                Create Account
                            </Link>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                            <span>&copy; 2026 Trishul</span>
                            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
