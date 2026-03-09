import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, MessageSquare, User, LogOut, Menu, X, Bell, Settings, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const StudentLayout = () => {
    const { user, logout } = useAuth();
    const { isDark, toggle } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/student/dashboard' },
        { icon: CreditCard, label: 'Payments', path: '/student/payments' },
        { icon: MessageSquare, label: 'Complaints', path: '/student/complaints' },
        { icon: User, label: 'Profile', path: '/student/profile' },
        { icon: Settings, label: 'Settings', path: '/student/settings' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 260 : 80 }}
                className="bg-slate-900 text-white flex-shrink-0 relative hidden md:flex flex-col shadow-xl z-20"
            >
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <span className="font-bold text-white text-lg">S</span>
                    </div>
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden"
                            >
                                Student Portal
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
                                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-all group ${!isSidebarOpen && 'justify-center'}`}
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="font-medium">Sign Out</span>}
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors hidden md:block">
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            {menuItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 relative hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        {/* Dark Mode Toggle */}
                        <button
                            onClick={toggle}
                            className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                            {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'ST'}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentLayout;
