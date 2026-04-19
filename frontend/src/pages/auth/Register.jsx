import { useState } from 'react';
import { User, Lock, Mail, Phone, ShieldCheck, ArrowRight, Loader2, KeyRound, CheckCircle2, Building2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../api/services';

const Register = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        hostel_name: '',
        hostel_phone: '',
        hostel_address: '',
        hostel_city: '',
        hostel_state: '',
        hostel_pincode: '',
        upi_id: '',
        gst_number: '',
        password: '',
        confirmPassword: '',
        role: 'admin'
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        const getApiErrorMessage = (err) => {
            const detail = err?.response?.data?.detail;
            const apiErrorMessage = err?.response?.data?.error?.message;
            if (typeof apiErrorMessage === 'string' && apiErrorMessage.trim()) {
                return apiErrorMessage;
            }
            if (typeof detail === 'string') return detail;
            if (Array.isArray(detail)) {
                return detail.map((d) => d?.msg).filter(Boolean).join(', ') || 'Registration failed';
            }
            if (detail && typeof detail === 'object') {
                return detail.message || detail.details || JSON.stringify(detail);
            }
            return err?.message || 'Registration failed';
        };

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (!/[A-Z]/.test(formData.password)) {
            setError('Password must contain at least one uppercase letter');
            return;
        }

        if (!/[a-z]/.test(formData.password)) {
            setError('Password must contain at least one lowercase letter');
            return;
        }

        if (!/[0-9]/.test(formData.password)) {
            setError('Password must contain at least one number');
            return;
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
            setError('Password must contain at least one special character');
            return;
        }

        setIsLoading(true);
        try {
            const { confirmPassword, ...registerData } = formData;
            await authService.register(registerData);
            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 3000);
        } catch (err) {
            console.error("Registration error:", err);
            setError(getApiErrorMessage(err));
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
                    className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center max-w-md w-full"
                >
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Registration Successful!</h2>
                    <p className="text-slate-500 mb-6 font-medium">Your account has been created. Redirecting you to login...</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 3 }}
                            className="bg-green-500 h-full"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Ambient Background */}
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

            {/* Register Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-[480px] relative z-10"
            >
                <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-3xl shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl mb-4 shadow-xl shadow-indigo-600/20 text-white transform rotate-3"
                        >
                            <ShieldCheck className="w-7 h-7" />
                        </motion.div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">
                            Owner <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Registration</span>
                        </h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                            Property Management Portal
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

                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Owner Details</div>
                        {/* Name Input */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Full Name</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                </div>
                                <input
                                    name="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100" />
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Hostel Details</div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Hostel Name</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Building2 className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                </div>
                                <input
                                    name="hostel_name"
                                    type="text"
                                    value={formData.hostel_name}
                                    onChange={handleChange}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="Trishul Boys Hostel"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Hostel Phone</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <input
                                        name="hostel_phone"
                                        type="tel"
                                        value={formData.hostel_phone}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="9876543210"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Pincode</label>
                                <input
                                    name="hostel_pincode"
                                    type="text"
                                    value={formData.hostel_pincode}
                                    onChange={handleChange}
                                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="500001"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Hostel Address</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-3 pointer-events-none">
                                    <MapPin className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                </div>
                                <textarea
                                    name="hostel_address"
                                    value={formData.hostel_address}
                                    onChange={handleChange}
                                    rows={2}
                                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm resize-none"
                                    placeholder="Street, Area, Landmark"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">City</label>
                                <input
                                    name="hostel_city"
                                    type="text"
                                    value={formData.hostel_city}
                                    onChange={handleChange}
                                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="Hyderabad"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">State</label>
                                <input
                                    name="hostel_state"
                                    type="text"
                                    value={formData.hostel_state}
                                    onChange={handleChange}
                                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="Telangana"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">UPI ID (Optional)</label>
                                <input
                                    name="upi_id"
                                    type="text"
                                    value={formData.upi_id}
                                    onChange={handleChange}
                                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="owner@upi"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">GST Number (Optional)</label>
                                <input
                                    name="gst_number"
                                    type="text"
                                    value={formData.gst_number}
                                    onChange={handleChange}
                                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                    placeholder="29ABCDE1234F1Z5"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Email Input */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <input
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Phone Input */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Phone</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <input
                                        name="phone"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="1234567890"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Password Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <KeyRound className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <input
                                        name="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Confirm</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <input
                                        name="confirmPassword"
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Info Note about Tenants */}
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                            <p className="text-[11px] text-indigo-700 font-bold leading-relaxed">
                                <span className="uppercase mr-1">Note:</span> This registration is for Property Owners only.
                                Students/Tenants will be created and invited by the Property Owner.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Create Account <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-sm text-slate-500 font-medium">
                            Already have an account?{' '}
                            <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-bold transition-colors">
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
