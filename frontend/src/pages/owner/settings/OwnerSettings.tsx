import React, { useEffect, useState } from 'react';
import { Loader2, Menu } from 'lucide-react';
import { ownerService, billingService, addonService } from '../../../api/services';
import { getActiveHostelId, setActiveHostelId } from '../../../lib/hostel/activeHostel';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import BuyRemindersModal from '../../../components/owner/BuyRemindersModal';

import {
    ProfileSection, HostelSection, BillingSection, TenantDefaultsSection,
    PaymentsSection, NotificationsSection, ReceiptsSection, AutomationSection,
    SecuritySection, SystemSection, sectionById, DEFAULT_PREFS
} from './sections';
import { SettingsNav, MobileOverview, MobileDrawer } from './layout';

import { AddHostelModal } from './components/AddHostelModal';

export function errorMessage(error: any, fallback: string) {
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.response?.data?.error?.message || error?.message;
    return `${fallback}${detail ? `. ${typeof detail === 'string' ? detail : detail.message || ''}` : ''}`;
}

export function mergePreferences(raw: any = {}) {
    return {
        ...DEFAULT_PREFS,
        ...raw,
        late_fee_rules: raw.late_fee_rules?.length ? raw.late_fee_rules : DEFAULT_PREFS.late_fee_rules,
        reminder_after_due_days: raw.reminder_after_due_days || [1, 5, 10],
        reminder_before_due_days: raw.reminder_before_due_days || [],
        billing_defaults: {
            ...DEFAULT_PREFS.billing_defaults,
            ...(raw.billing_defaults || {}),
        },
    };
}

export default function OwnerSettings() {
    const { updatePreferencesLocal } = useAppPreferences() as any;
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [owner, setOwner] = useState<any>(null);
    const [hostels, setHostels] = useState<any[]>([]);
    const [activeHostelId, setActiveHostelIdState] = useState('');
    const [hostel, setHostel] = useState<any>(null);
    const [prefs, setPrefs] = useState<any>(DEFAULT_PREFS);
    const [plan, setPlan] = useState<any>(null);
    const [planId, setPlanId] = useState('free');
    const [addonUsage, setAddonUsage] = useState<any>(null);
    
    const [activeSection, setActiveSection] = useState(() => (
        typeof window !== 'undefined' && window.innerWidth < 768 ? 'overview' : 'profile'
    ));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [buyCreditsModal, setBuyCreditsModal] = useState<string | null>(null);
    const [addHostelModalOpen, setAddHostelModalOpen] = useState(false);

    async function load(selectedId?: string) {
        setLoading(true);
        setPageError('');
        try {
            const [profileData, hostelsData, subscriptionData, usageData] = await Promise.all([
                ownerService.getProfile(),
                ownerService.getHostels(),
                billingService.getSubscription().catch(() => null),
                addonService.getUsage().catch(() => null),
            ]);
            const nextOwner = profileData?.owner || {};
            const nextHostels = hostelsData?.hostels || profileData?.hostels || [];
            const ownerScope = { ...nextOwner, role: 'owner', owner_id: nextOwner.id };
            const chosenId = selectedId || getActiveHostelId(ownerScope) || nextHostels[0]?.id || '';
            const policyResponse = chosenId ? await ownerService.getHostelPreferences(chosenId) : null;
            const nextHostel = policyResponse?.hostel || nextHostels.find((item: any) => item.id === chosenId) || null;
            const nextPrefs = mergePreferences(policyResponse?.compatibility_preferences || {});
            
            if (chosenId) setActiveHostelId(ownerScope, chosenId);
            
            setOwner(nextOwner);
            setHostels(nextHostels);
            setActiveHostelIdState(chosenId);
            setHostel(nextHostel);
            setPrefs(nextPrefs);
            setPlan(subscriptionData?.current_plan || null);
            setPlanId(subscriptionData?.current_plan?.id || subscriptionData?.plan_id || 'free');
            setAddonUsage(usageData || null);
            updatePreferencesLocal(nextPrefs);
        } catch (error) {
            setPageError(errorMessage(error, 'Failed to load settings'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function switchHostel(id: string) {
        if (id === 'ADD_NEW') {
            setAddHostelModalOpen(true);
            return;
        }
        if (!id || id === activeHostelId) return;
        await load(id);
    }

    async function createNewHostel(values: any) {
        const response = await ownerService.createHostel(values);
        const newHostels = response?.hostels || [];
        // The newly created hostel should be the last one if ordered by created_at, or we can just pick it if it's the only one missing
        // It's safer to just reload and pick the newly created one. We'll pick the last one in the array.
        const newId = newHostels[newHostels.length - 1]?.id;
        await load(newId);
    }

    async function saveProfile(values: any) {
        const response = await ownerService.updateProfileSection(values);
        setOwner((current: any) => ({ ...current, ...(response?.profile || values) }));
    }

    async function saveHostel(values: any) {
        const response = await ownerService.updateHostel(values, activeHostelId);
        setHostel((current: any) => ({ ...current, ...(response?.hostel || values) }));
    }

    async function saveConfig(section: string, values: any) {
        const response = await ownerService.updateSectionConfig(activeHostelId, section, values);
        const nextPrefs = mergePreferences(response?.compatibility_preferences || prefs);
        setPrefs(nextPrefs);
        updatePreferencesLocal(nextPrefs);
    }

    async function uploadLogo(file: File) {
        const response = await ownerService.uploadLogo(file, activeHostelId);
        setHostel((current: any) => ({ ...current, ...(response?.hostel || {}) }));
        return response;
    }

    async function setAutoTopup(enabled: boolean) {
        const response = await addonService.setAutoTopup(enabled, 'settings');
        setAddonUsage((current: any) => ({ ...(current || {}), auto_topup: response?.auto_topup ?? enabled }));
    }

    async function sendTestReminder() {
        await ownerService.sendTestReminder('DUE_SOON', activeHostelId);
    }

    function renderSection() {
        if (!sectionById[activeSection] || activeSection === 'overview') {
            return <MobileOverview setActiveSection={setActiveSection} />;
        }
        
        const onBack = () => setActiveSection('overview');
        const common = { activeHostel: hostel, onBack };
        
        function hasAutomation(pid: string) {
            return !['free', 'trial'].includes(String(pid || 'free').toLowerCase());
        }
        
        switch (activeSection) {
            case 'profile': return <ProfileSection owner={owner} onSave={saveProfile} onBack={onBack} />;
            case 'hostel': return <HostelSection hostel={hostel} onSave={saveHostel} onUploadLogo={uploadLogo} {...common} />;
            case 'billing': return <BillingSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'tenant-defaults': return <TenantDefaultsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'payments': return <PaymentsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'notifications': return <NotificationsSection prefs={prefs} addonUsage={addonUsage} onSave={saveConfig} onTopup={() => setBuyCreditsModal('manual')} onAutoTopup={setAutoTopup} onTestReminder={sendTestReminder} {...common} />;
            case 'receipts': return <ReceiptsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'automation': return <AutomationSection prefs={prefs} onSave={saveConfig} automationEnabled={hasAutomation(planId)} {...common} />;
            case 'security': return <SecuritySection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'system': return <SystemSection prefs={prefs} onSave={saveConfig} {...common} />;
            default: return null;
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface-50 text-ink-600">
                <Loader2 className="animate-spin" size={22} aria-hidden="true" />
                <span className="ml-2 text-base">Loading settings...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 text-ink-900 dark:bg-ink-950 dark:text-ink-50">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 border-r border-ink-200/60 bg-surface-0 p-3 dark:bg-ink-950 md:block lg:w-56">
                <div className="hidden lg:block">
                    <SettingsNav activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={setActiveSection} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={switchHostel} planId={planId} />
                </div>
                <div className="lg:hidden">
                    <SettingsNav compact activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={setActiveSection} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={switchHostel} planId={planId} />
                </div>
            </aside>

            <main className="px-4 py-0 md:ml-16 md:px-6 md:py-6 lg:ml-56">
                <div className="mx-auto max-w-2xl">
                    {pageError && <div className="mb-4 rounded-md border border-danger-500 bg-danger-50 p-3 text-sm text-danger-500">{pageError}</div>}
                    {renderSection()}
                </div>
            </main>

            <button type="button" onClick={() => setDrawerOpen(true)} className="fixed bottom-4 left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-brand-500 px-5 text-base font-medium text-white shadow-lg md:hidden">
                <Menu size={16} aria-hidden="true" /> Settings
            </button>
            
            <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <SettingsNav activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={(id: string) => { setActiveSection(id); setDrawerOpen(false); }} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={(id: string) => { switchHostel(id); setDrawerOpen(false); }} planId={planId} />
            </MobileDrawer>
            
            {buyCreditsModal && <BuyRemindersModal isOpen={!!buyCreditsModal} onClose={() => setBuyCreditsModal(null)} trigger={buyCreditsModal} onSuccess={() => load(activeHostelId)} />}
            
            <AddHostelModal isOpen={addHostelModalOpen} onClose={() => setAddHostelModalOpen(false)} onSubmit={createNewHostel} plan={plan} hostelsCount={hostels.length} />
        </div>
    );
}
