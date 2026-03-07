import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, Mail, User } from 'lucide-react';
import api from '../../api/axios';

const ActivateAccount = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleActivate = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await api.post('/students/activate', { token, password });
            setIsSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.detail?.message || "Activation failed. The link might be expired.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Invalid Link</h2>
                    <p className="text-slate-500 mb-6">This activation link is invalid or has expired.</p>
                    <button onClick={() => navigate('/login')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Return to Login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[440px] relative z-10"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-4">Account Activated!</h2>
                                <p className="text-slate-500 font-medium mb-8">
                                    Your password has been set successfully. Redirecting you to the login page...
                                </p>
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                            </motion.div>
                        ) : (
                            <motion.div key="form">
                                <div className="text-center mb-10">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-6 shadow-xl text-white transform rotate-3">
                                        <KeyRound className="w-8 h-8" />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Activate Account</h1>
                                    <p className="text-slate-500 text-sm font-medium">Set your secure password to get started</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 text-center">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleActivate} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">New Password</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="block w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Confirm Password</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="block w-full pl-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center py-4 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-70 mt-4"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Activate Account"}
                                    </button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default ActivateAccount;
