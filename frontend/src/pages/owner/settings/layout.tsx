import React from 'react';
import { Menu, X } from 'lucide-react';
import { sectionsMeta, sectionById } from './sections';
import { cx, inputClass } from './components/ui';

export function SettingsNav({ activeSection, setActiveSection, hostels, activeHostelId, onHostelChange, planId, compact = false }: any) {
    const groups = ['ACCOUNT', 'BILLING', 'COMMUNICATION', 'CONTROL'];
    
    function hasAutomation(pid: string) {
        return !['free', 'trial'].includes(String(pid || 'free').toLowerCase());
    }

    return (
        <nav aria-label="Settings navigation" className="space-y-5">
            <div className={cx('flex items-center gap-3', compact && 'justify-center')}>
                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-brand-500 text-2xs font-bold text-white">AG</div>
                {!compact && <p className="text-base font-semibold text-ink-900 dark:text-ink-50">Apna Ghar</p>}
            </div>
            
            {!compact && (
                <select value={activeHostelId || ''} onChange={(e) => onHostelChange(e.target.value)} className={inputClass}>
                    {hostels.map((hostel: any) => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}
                </select>
            )}
            
            {groups.map((group) => (
                <div key={group}>
                    {!compact && <p className="mb-2 px-3 text-2xs font-semibold uppercase tracking-widest text-ink-400">{group}</p>}
                    <div className="space-y-1">
                        {sectionsMeta.filter((s) => s.group === group).map((section) => {
                            const Icon = section.icon;
                            const active = activeSection === section.id;
                            const proLocked = section.pro && !hasAutomation(planId);
                            
                            return (
                                <button key={section.id} type="button" aria-current={active ? 'page' : undefined} title={compact ? section.label : undefined} onClick={() => setActiveSection(section.id)} className={cx('group relative flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 px-3 text-left text-base font-medium transition', active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-transparent text-ink-600 hover:bg-surface-100 dark:text-ink-300', compact && 'justify-center px-2')}>
                                    <Icon size={18} aria-hidden="true" />
                                    {!compact && <span className="flex-1">{section.label}</span>}
                                    {!compact && proLocked && <span className="rounded-full bg-ink-100 px-2 py-1 text-2xs text-ink-500">Pro</span>}
                                    {compact && <span className="pointer-events-none absolute left-12 z-50 hidden rounded-md bg-ink-900 px-2 py-1 text-xs text-white group-hover:block">{section.label}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}

export function MobileOverview({ setActiveSection }: any) {
    return (
        <div className="md:hidden">
            <div className="sticky top-0 z-40 -mx-4 mb-4 flex h-14 items-center border-b border-ink-200/40 bg-surface-0 px-4 dark:bg-ink-950">
                <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Settings</h1>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {sectionsMeta.map((section) => { 
                    const Icon = section.icon; 
                    return (
                        <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-ink-200 bg-surface-0 p-3 text-center text-xs font-medium text-ink-700 shadow-sm">
                            <Icon size={20} aria-hidden="true" />
                            {section.label}
                        </button>
                    ); 
                })}
            </div>
        </div>
    );
}

export function MobileDrawer({ open, onClose, children }: any) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 md:hidden">
            <button aria-label="Close settings menu" type="button" onClick={onClose} className="absolute inset-0 bg-ink-900/50" />
            <div className="absolute inset-x-0 bottom-0 max-h-dvh overflow-y-auto rounded-t-xl bg-surface-0 p-4 shadow-lg dark:bg-ink-950">
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-base font-semibold text-ink-900 dark:text-ink-50">Settings menu</p>
                    <button type="button" aria-label="Close menu" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-surface-100">
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
