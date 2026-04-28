import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Eye, EyeOff, Save, CheckCircle2, Shield, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../api/services';

const TenantSettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Password State
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    // Notification State (Mock)
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        updates: false
    });

    const [showPassword, setShowPassword] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const toggleVisibility = (field) => {
        setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswords(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();

        if (passwords.new !== passwords.confirm) {
            alert("Passwords do not match!");
            return;
        }

        if (passwords.new.length < 6) {
            alert("New password must be at least 6 characters long.");
            return;
        }

        setLoading(true);
        try {
            await authService.changePassword(passwords.current, passwords.new);
            setPasswords({ current: '', new: '', confirm: '' });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update password:", error);
            const message = error.response?.data?.detail?.message || error.message || "Failed to update password";
            alert(message);
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in-up">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">Manage your account security and preferences</p>
            </div>

            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-24 right-8 z-50 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm"
                    >
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Password updated successfully!
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Main Content - Security */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                <Shield size={18} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Security</h3>
                                <p className="text-xs text-slate-500">Update your password to keep your account safe</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-5">
                            <PasswordInput
                                label="Current Password"
                                name="current"
                                value={passwords.current}
                                show={showPassword.current}
                                onToggle={() => toggleVisibility('current')}
                                onChange={handlePasswordChange}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <PasswordInput
                                    label="New Password"
                                    name="new"
                                    value={passwords.new}
                                    show={showPassword.new}
                                    onToggle={() => toggleVisibility('new')}
                                    onChange={handlePasswordChange}
                                />
                                <PasswordInput
                                    label="Confirm Password"
                                    name="confirm"
                                    value={passwords.confirm}
                                    show={showPassword.confirm}
                                    onToggle={() => toggleVisibility('confirm')}
                                    onChange={handlePasswordChange}
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                    {!loading && <Save size={16} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Sidebar - Notifications */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                <Bell size={18} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Notifications</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Email Alerts</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={notifications.email} onChange={() => setNotifications(prev => ({ ...prev, email: !prev.email }))} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Push Notifications</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={notifications.push} onChange={() => setNotifications(prev => ({ ...prev, push: !prev.push }))} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const PasswordInput = ({ label, name, value, show, onToggle, onChange }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1">{label}</label>
        <div className="relative">
            <div className="absolute left-3 top-3 text-slate-400">
                <Key size={16} />
            </div>
            <input
                type={show ? "text" : "password"}
                name={name}
                value={value}
                onChange={onChange}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="••••••••"
            />
            <button
                type="button"
                onClick={onToggle}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
            >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    </div>
);

export default TenantSettings;
