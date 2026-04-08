
import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Menu, X, Home, Bed, Users, CreditCard, MessageSquare, Receipt,
    Search, Bell, ChevronLeft, ChevronRight, LogOut, Settings, User,
    ShieldCheck, AlertCircle, CheckCircle2, Clock, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { notificationService, ownerService } from '../api/services';
import SearchResultsDropdown from '../components/owner/SearchResultsDropdown';
import ProfileMenu from '../components/owner/ProfileMenu';
import Avatar from '../components/common/Avatar';


const OwnerLayout = () => {
    const { user, logout } = useAuth();
    const [hostelLogoUrl, setHostelLogoUrl] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
    const [searchError, setSearchError] = useState(false);

    // Poll for notifications
    const fetchNotifications = async () => {
        try {
            const response = await notificationService.getAll();
            setNotifications(response);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadHostelBranding = async () => {
            try {
                const profile = await ownerService.getProfile();
                if (mounted) {
                    setHostelLogoUrl(profile?.hostel?.logo_url || '');
                }
            } catch {
                if (mounted) {
                    setHostelLogoUrl('');
                }
            }
        };

        const handleBrandingUpdate = (event) => {
            const nextLogo = event?.detail?.logoUrl || '';
            setHostelLogoUrl(nextLogo);
        };

        loadHostelBranding();
        window.addEventListener('owner-branding-updated', handleBrandingUpdate);

        return () => {
            mounted = false;
            window.removeEventListener('owner-branding-updated', handleBrandingUpdate);
        };
    }, []);

    const handleMarkAllRead = async () => {
        try {
            const unread = notifications.filter(n => !n.is_read);
            await Promise.all(unread.map(n => notificationService.markAsRead(n.id)));
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark all read:", error);
        }
    };

    // Dropdown States
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [sidebarAccountOpen, setSidebarAccountOpen] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Refs for clicking outside
    const notificationRef = useRef(null);
    const profileRef = useRef(null);
    const sidebarAccountRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
            if (profileRef.current && !profileRef.current.contains(event.target)) setProfileMenuOpen(false);
            if (sidebarAccountRef.current && !sidebarAccountRef.current.contains(event.target)) setSidebarAccountOpen(false);
            if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const normalized = searchQuery.trim();
        if (normalized.length < 2) {
            setSearchResults([]);
            setSearchLoading(false);
            setSearchOpen(false);
            setActiveSearchIndex(-1);
            setSearchError(false);
            return undefined;
        }

        let cancelled = false;
        setSearchLoading(true);

        const timer = window.setTimeout(async () => {
            try {
                const results = await ownerService.searchTenants(normalized, 10);
                const normalizedResults = Array.isArray(results) ? results : [];
                if (!cancelled) {
                    setSearchError(false);
                    setSearchResults(normalizedResults);
                    setSearchOpen(true);
                    setActiveSearchIndex(normalizedResults.length ? 0 : -1);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to search tenants:', error);
                    setSearchError(true);
                    setSearchResults([]);
                    setSearchOpen(true);
                    setActiveSearchIndex(-1);
                }
            } finally {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchQuery]);

    const handleTenantSelect = (tenant) => {
        setSearchQuery('');
        setSearchResults([]);
        setSearchOpen(false);
        setActiveSearchIndex(-1);
        setSearchError(false);
        navigate('/owner/students', { state: { selectedTenantId: tenant.id } });
    };

    const handleSearchKeyDown = (event) => {
        if (!searchOpen || searchResults.length === 0) {
            if (event.key === 'Escape') {
                setSearchOpen(false);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSearchIndex(prev => (prev + 1) % searchResults.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSearchIndex(prev => (prev <= 0 ? searchResults.length - 1 : prev - 1));
            return;
        }

        if (event.key === 'Enter' && activeSearchIndex >= 0) {
            event.preventDefault();
            handleTenantSelect(searchResults[activeSearchIndex]);
            return;
        }

        if (event.key === 'Escape') {
            setSearchOpen(false);
        }
    };

    const menuItems = [
        { name: 'Dashboard', icon: Home, path: '/owner/dashboard' },
        { name: 'Rooms', icon: Bed, path: '/owner/rooms' },
        { name: 'Tenants', icon: Users, path: '/owner/students' },
        { name: 'Payments', icon: CreditCard, path: '/owner/payments' },
        { name: 'Expenses', icon: Receipt, path: '/owner/expenses' },
        { name: 'Activity Log', icon: Clock, path: '/owner/activities' },
        { name: 'Billing & Plans', icon: CreditCard, path: '/owner/billing' },
    ];

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getNotificationIcon = (type) => {
        const t = type?.toLowerCase();
        switch (t) {
            case 'payment': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'tenant': return <User size={16} className="text-indigo-500" />;
            case 'room': return <Bed size={16} className="text-indigo-500" />;
            case 'complaint': return <AlertCircle size={16} className="text-yellow-500" />;
            default: return <Clock size={16} className="text-slate-500" />;
        }
    };

    const formatTime = (dateStr) => {
        const now = new Date();
        const past = new Date(dateStr);
        const diff = Math.floor((now - past) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return past.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex overflow-x-hidden relative">
            {/* Sidebar (Desktop) */}
            <aside
                className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out shadow-xl ${sidebarOpen ? 'w-72' : 'w-20'}`}
            >
                {/* Logo Section */}
                <div
                    className="h-16 flex items-center px-6 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => navigate('/owner/dashboard')}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-800/50 overflow-hidden">
                            <img src="https://trishul.solutions/logo.png" alt="Trishul Logo" className="w-7 h-7 object-contain" />
                        </div>
                        <div className={`transition-all duration-300 ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 hidden'}`}>
                            <h1 className="font-bold text-lg tracking-tight text-white leading-tight">
                                Trishul <span className="text-indigo-400">Solutions</span>
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 py-6 flex flex-col gap-1.5 px-3 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path === '/owner/dashboard' && location.pathname === '/owner');

                        return (
                            <button
                                key={item.name}
                                onClick={() => navigate(item.path)}
                                className={`
                                    relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group
                                    ${isActive
                                        ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/20'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                                `}
                            >
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className={`whitespace-nowrap transition-all duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                                    {item.name}
                                </span>

                                {/* Tooltip for collapsed state */}
                                {!sidebarOpen && (
                                    <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700 transition-opacity">
                                        {item.name}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Account Section */}
                <div className="p-4 border-t border-slate-800" ref={sidebarAccountRef}>
                    <div className="relative">
                        <button
                            onClick={() => setSidebarAccountOpen(!sidebarAccountOpen)}
                            className={`flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all shadow-sm ${!sidebarOpen && 'justify-center'}`}
                        >
                            <Avatar
                                src={hostelLogoUrl}
                                name={user?.name}
                                size={36}
                                className="border border-slate-700 bg-slate-800 text-slate-200"
                            />
                            {sidebarOpen && (
                                <div className="text-left overflow-hidden flex-1">
                                    <p className="text-sm font-bold text-white truncate">{user?.name || 'User'}</p>
                                    <p className="text-xs font-medium text-slate-400 truncate capitalize">{user?.role || 'Staff'}</p>
                                </div>
                            )}
                            {sidebarOpen && <ChevronDown size={14} className={`text-slate-500 transition-transform ${sidebarAccountOpen ? 'rotate-180' : ''}`} />}
                        </button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {sidebarAccountOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className={`absolute bottom-full mb-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 ${sidebarOpen ? 'left-0 w-full' : 'left-full ml-2 w-48'}`}
                                >
                                    <div className="p-1">
                                        <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg">
                                            <Settings size={16} /> Settings
                                        </button>
                                        <div className="h-px bg-slate-50 my-1" />
                                        <button
                                            onClick={handleLogout}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg"
                                        >
                                            <LogOut size={16} /> Logout
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Collapse Toggle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="absolute -right-3 top-[-12px] w-6 h-6 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 shadow-sm z-50 transition-colors"
                    >
                        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            <div className={`lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} />
            <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-800">
                            <img src="https://trishul.solutions/logo.png" alt="Trishul Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className="font-bold text-lg text-white">Trishul</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="p-4 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${(location.pathname === item.path) ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            {item.name}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto p-4 border-t border-slate-800">
                    <div className="mb-3 px-2">
                        <p className="text-sm font-semibold text-white truncate">{user?.name || 'Owner'}</p>
                        <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
                    </div>
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className={`flex-1 flex flex-col min-h-screen max-w-full transition-all duration-300 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-20'} overflow-x-hidden`}>

                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-900">
                            <Menu size={24} />
                        </button>

                        {/* Search Bar */}
                        <div className="relative hidden md:block w-80" ref={searchRef}>
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all group">
                                <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    onFocus={() => {
                                        if (searchResults.length > 0 || searchQuery.trim().length >= 2) {
                                            setSearchOpen(true);
                                        }
                                    }}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search tenants, phone, room..."
                                    className="bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 w-full"
                                />
                                <div className="hidden lg:flex items-center gap-1">
                                    <span className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-medium">⌘</span>
                                    <span className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-medium">K</span>
                                </div>
                            </div>
                            <SearchResultsDropdown
                                isOpen={searchOpen}
                                isLoading={searchLoading}
                                hasError={searchError}
                                query={searchQuery.trim()}
                                results={searchResults}
                                activeIndex={activeSearchIndex}
                                onSelect={handleTenantSelect}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className={`relative p-2 rounded-full transition-colors ${notificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white pointer-events-none"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            <AnimatePresence>
                                {notificationsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right"
                                    >
                                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <h3 className="font-semibold text-slate-900">Notifications</h3>
                                            <button
                                                onClick={handleMarkAllRead}
                                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                            >
                                                Mark all read
                                            </button>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500">
                                                    <Bell size={24} className="mx-auto mb-2 opacity-20" />
                                                    <p className="text-sm">No new notifications</p>
                                                </div>
                                            ) : (
                                                notifications.map(notification => (
                                                    <div key={notification.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notification.is_read ? 'bg-indigo-50/30' : ''}`}>
                                                        <div className={`mt-0.5 p-1.5 rounded-full ${!notification.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                                            {getNotificationIcon(notification.type)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-0.5">
                                                                <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                                    {notification.title}
                                                                </p>
                                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                                                                    {formatTime(notification.created_at)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 line-clamp-2">{notification.message}</p>
                                                        </div>
                                                        {!notification.is_read && (
                                                            <div className="self-center w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                                            <button className="w-full py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                                                View all notifications
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

                        <ProfileMenu
                            user={user}
                            logoUrl={hostelLogoUrl}
                            isOpen={profileMenuOpen}
                            onToggle={() => setProfileMenuOpen(!profileMenuOpen)}
                            onProfileSettings={() => {
                                setProfileMenuOpen(false);
                                navigate('/owner/profile?tab=owner');
                            }}
                            onBilling={() => {
                                setProfileMenuOpen(false);
                                navigate('/owner/billing');
                            }}
                            onPreferences={() => {
                                setProfileMenuOpen(false);
                                navigate('/owner/profile?tab=preferences');
                            }}
                            onSignOut={handleLogout}
                            menuRef={profileRef}
                        />
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 p-3 sm:p-8 overflow-y-auto overflow-x-hidden pb-safe">
                    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in-up">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OwnerLayout;
