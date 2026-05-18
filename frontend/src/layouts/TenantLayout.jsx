import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, User, LogOut, Menu, Bell, Settings, X, DoorOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { notificationService } from '../api/services';
import Avatar from '../components/common/Avatar';

const TenantLayout = () => {
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        let mounted = true;

        const fetchNotifications = async () => {
            try {
                const notifications = await notificationService.getAll();
                if (!mounted) return;
                const unread = (notifications || []).filter(n => !n.is_read).length;
                setUnreadCount(unread);
            } catch (error) {
                if (mounted) setUnreadCount(0);
            }
        };

        fetchNotifications();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                fetchNotifications();
            }
        }, 300000); // Poll every 5 minutes only when tab is active
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/tenant/dashboard' },
        { icon: CreditCard, label: 'Financials', path: '/tenant/payments' },
        { icon: DoorOpen, label: 'Move-Out', path: '/tenant/move-out' },
        { icon: User, label: 'Profile', path: '/tenant/profile' },
        { icon: Settings, label: 'Settings', path: '/tenant/settings' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="flex h-screen bg-ops-surface font-sans text-foreground">
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 260 : 80 }}
                className="bg-slate-900 text-white flex-shrink-0 relative hidden md:flex flex-col shadow-xl z-20"
            >
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-ops-accent to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
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
                                Tenant Portal
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
                                    ? 'bg-ops-accent text-white shadow-lg shadow-teal-900/20'
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

            {/* Mobile Sidebar (Overlay) */}
            <div
                className={`md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setMobileMenuOpen(false)}
            />
            <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-ops-accent to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <span className="font-bold text-white text-lg">S</span>
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white">Tenant Portal</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-ops-accent text-white font-semibold'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 border-t border-slate-800">
                    <div className="mb-3 px-2">
                        <p className="text-sm font-semibold text-white truncate">{user?.name || 'Tenant'}</p>
                        <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
                    </div>
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-all"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors md:hidden">
                            <Menu size={20} />
                        </button>
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors hidden md:block">
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            {menuItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/tenant/dashboard#announcements')}
                            className="p-2 relative hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                            title="View announcements"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <>
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                </>
                            )}
                        </button>
                        <Avatar
                            src={user?.avatar_url || user?.profile_photo_url || user?.avatar}
                            name={user?.name}
                            size={32}
                            className="border border-ops-accent/200 hover:ring-2 hover:ring-indigo-500 transition-all"
                        />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TenantLayout;
