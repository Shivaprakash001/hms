import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CreditCard, LogOut, Settings, User } from 'lucide-react';

const ProfileMenu = ({
    user,
    isOpen,
    onToggle,
    onProfileSettings,
    onBilling,
    onPreferences,
    onSignOut,
    menuRef,
}) => {
    const role = user?.role || 'Staff';
    const firstName = user?.name?.trim()?.split(' ')?.[0] || 'User';
    const avatarInitial = user?.name?.trim()?.[0]?.toUpperCase() || 'U';

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={onToggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`${firstName} profile menu`}
                className="hidden sm:flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group"
            >
                <div className="text-end leading-tight">
                    <p className="text-xs font-medium text-slate-500 capitalize">{role}</p>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{firstName}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm ring-2 ring-white">
                    {avatarInitial || <User size={18} />}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
                type="button"
                onClick={onToggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label="Open profile menu"
                className="flex sm:hidden p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm ring-2 ring-white">
                    {avatarInitial || <User size={18} />}
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-2 sm:right-0 mt-2 w-56 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right"
                        role="menu"
                    >
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Account</p>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5">{user?.name || 'User'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                        </div>

                        <div className="p-1.5">
                            <button
                                type="button"
                                onClick={onProfileSettings}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                                role="menuitem"
                            >
                                <User size={16} /> Profile Settings
                            </button>
                            <button
                                type="button"
                                onClick={onBilling}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                                role="menuitem"
                            >
                                <CreditCard size={16} /> Billing & Plans
                            </button>
                            <button
                                type="button"
                                onClick={onPreferences}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                                role="menuitem"
                            >
                                <Settings size={16} /> Preferences
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                                type="button"
                                onClick={onSignOut}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                role="menuitem"
                            >
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProfileMenu;