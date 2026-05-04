import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { User, Building2, Settings, Save, Loader2, ChevronDown, ChevronRight, Receipt, Bell, CreditCard, Shield, Zap, Globe, IndianRupee, Calendar, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Send, Lock, Trash2, Plus, ArrowRight, X, ShieldAlert } from 'lucide-react';
import { migrateLegacyPrefs, createDefaultRule, simulateBilling, calculateWhatIf } from '../../utils/billing-simulator';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ownerService, billingService, addonService } from '../../api/services';
import ProfileLogoUploader from '../../components/owner/ProfileLogoUploader';
import BuyRemindersModal from '../../components/owner/BuyRemindersModal';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatDateTime } from '../../utils/format';

// ─── Plan access map ──────────────────────────────────────────────────────────
const PLAN_ACCESS = {
    free:     { automation: false },
    starter:  { automation: true },
    growth:   { automation: true },
    business: { automation: true },
    scale:    { automation: true },
};

function getPlanAccess(planId) {
    const key = (planId || 'free').toLowerCase();
    return PLAN_ACCESS[key] || PLAN_ACCESS.free;
}

const tabs = [
    { key: 'owner', label: 'Owner Profile', icon: User },
    { key: 'hostel', label: 'Hostel Details', icon: Building2 },
    { key: 'preferences', label: 'Preferences', icon: Settings },
];

const prefModules = [
    { key: 'billing', label: 'Billing', icon: IndianRupee, desc: 'Rent cycle, generation day, due dates, late fees' },
    { key: 'payments', label: 'Payments', icon: CreditCard, desc: 'UPI ID, gateway, partial payments' },
    { key: 'notifications', label: 'Notifications', icon: Bell, desc: 'Reminder channels & schedule' },
    { key: 'automation', label: 'Automation', icon: Zap, desc: 'Auto-generate rent, late fees, reminders' },
    { key: 'receipts', label: 'Receipts', icon: Receipt, desc: 'Prefix, format, auto-email' },
    { key: 'security', label: 'Security', icon: Shield, desc: 'Document approval, data retention' },
    { key: 'system', label: 'System', icon: Globe, desc: 'Currency, timezone, date format' },
];

export default function OwnerProfile() {
    const { updatePreferencesLocal } = useAppPreferences();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabFromUrl && tabs.some(t => t.key === tabFromUrl) ? tabFromUrl : 'owner');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const [currentPlan, setCurrentPlan] = useState('FREE');
    const [upgradeModal, setUpgradeModal] = useState(null); // { feature, requiredPlan }
    const [buyCreditsModal, setBuyCreditsModal] = useState(null); // null | 'empty' | 'low' | 'manual'
    const [reminderCredits, setReminderCredits] = useState(null); // null = loading
    const [cronStopped, setCronStopped] = useState(false);        // cron paused due to 0 credits
    const [autoTopup, setAutoTopup] = useState(false);            // owner's auto-topup preference
    const [retryToast, setRetryToast] = useState(null); // { action, label } | null

    const [ownerForm, setOwnerForm] = useState({ name: '', email: '', phone: '' });
    const [hostelForm, setHostelForm] = useState({
        name: '', phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: '', logo_url: ''
    });

    const [isEditingOwner, setIsEditingOwner] = useState(false);
    const [isEditingHostel, setIsEditingHostel] = useState(false);

    const [preferences, setPreferences] = useState({
        currency: 'INR', rent_cycle: 'MONTHLY', auto_rent_day: 1, due_day: 5,
        late_fee_type: 'none', late_fee_amount: 200, late_fee_percentage: 5,
        late_fee_after_days: 7, max_late_fee: 500, grace_days: 0, late_fee_rules: [],
        upi_id: '', phonepe_merchant_id: '', allow_partial_payments: false, min_payment_amount: 500,
        reminder_email: true, reminder_in_app: true, reminder_whatsapp: false,
        reminder_day_1: true, reminder_day_5: true, reminder_day_10: true,
        late_fee_notification: true, owner_daily_summary: false,
        auto_generate_rent: true, auto_apply_late_fees: true, auto_send_reminders: true, auto_deactivate_days: 0,
        receipt_prefix: 'HMS', receipt_format: 'PREFIX-YEAR-SEQ', auto_email_receipt: false, receipt_footer: '',
        require_doc_approval: false, require_aadhaar: false, allow_tenant_edits: true, data_retention_months: 0,
        timezone: 'Asia/Kolkata', date_format: 'DD/MM/YYYY', time_format: '12h', language: 'en',
    });

    // FIX #1: Multiple modules open simultaneously (Set instead of single key)
    const [openModules, setOpenModules] = useState(new Set());
    const [dirtyModules, setDirtyModules] = useState(new Set());
    // Snapshot for dirty detection
    const [savedPreferences, setSavedPreferences] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true); setError('');
            try {
                const [data, subData, addonData] = await Promise.all([
                    ownerService.getProfile(),
                    billingService.getSubscription().catch(() => null),
                    addonService.getUsage().catch(() => null),
                ]);

                if (subData?.current_plan?.id) {
                    setCurrentPlan(subData.current_plan.id);
                }
                const credits = addonData?.reminders_remaining ?? 0;
                setReminderCredits(credits);
                setCronStopped(addonData?.cron_stopped ?? false);
                setAutoTopup(addonData?.auto_topup ?? false);

                // Handle return from PhonePe addon payment
                const params = new URLSearchParams(window.location.search);
                if (params.get('status') === 'addon_success') {
                    const attemptId = params.get('attempt_id');
                    window.history.replaceState({}, '', window.location.pathname);

                    // Verify fallback: call /api/addons/verify in case webhook missed
                    // This is idempotent — safe even if webhook already ran
                    try {
                        const verifyResult = await addonService.verifyPayment(attemptId);
                        const freshCredits = verifyResult?.credits_remaining ?? null;
                        if (freshCredits !== null) setReminderCredits(freshCredits);
                    } catch {
                        // Non-critical: fall back to getUsage
                        addonService.getUsage().then(d => setReminderCredits(d?.reminders_remaining ?? 0)).catch(() => {});
                    }

                    // Show retry toast if user had a pending action before buying
                    const pendingAction = sessionStorage.getItem('pending_reminder_action');
                    if (pendingAction) {
                        sessionStorage.removeItem('pending_reminder_action');
                        const addedCredits = parseInt(params.get('credits') || '0', 10);
                        setRetryToast({
                            action: pendingAction,
                            label: `✅ ${addedCredits || 'Credits'} added. Click to retry sending reminder.`,
                        });
                        setTimeout(() => setRetryToast(null), 8000);
                    }
                }

                const owner = data?.owner || {};
                const hostel = data?.hostel || {};
                const prefs = data?.preferences || {};
                setOwnerForm({ name: owner.name || '', email: owner.email || '', phone: owner.phone || '' });
                setHostelForm({
                    name: hostel.name || '', phone: hostel.phone || '', address: hostel.address || '',
                    city: hostel.city || '', state: hostel.state || '', pincode: hostel.pincode || '',
                    upi_id: hostel.upi_id || '', gst_number: hostel.gst_number || '', logo_url: hostel.logo_url || ''
                });
                const merged = {
                    ...preferences,
                    currency: prefs.currency || preferences.currency,
                    rent_cycle: prefs.rent_cycle || preferences.rent_cycle,
                    receipt_prefix: prefs.receipt_prefix || preferences.receipt_prefix,
                    timezone: prefs.timezone || preferences.timezone,
                    auto_rent_day: prefs.auto_rent_day || preferences.auto_rent_day,
                    phonepe_merchant_id: prefs.phonepe_merchant_id || '',
                    upi_id: hostel.upi_id || '',
                    ...(prefs.due_day !== undefined && { due_day: prefs.due_day }),
                    ...(prefs.late_fee_type !== undefined && { late_fee_type: prefs.late_fee_type }),
                    ...(prefs.late_fee_amount !== undefined && { late_fee_amount: prefs.late_fee_amount }),
                    ...(prefs.late_fee_percentage !== undefined && { late_fee_percentage: prefs.late_fee_percentage }),
                    ...(prefs.late_fee_after_days !== undefined && { late_fee_after_days: prefs.late_fee_after_days }),
                    ...(prefs.max_late_fee !== undefined && { max_late_fee: prefs.max_late_fee }),
                    ...(prefs.grace_days !== undefined && { grace_days: prefs.grace_days }),
                    ...(prefs.late_fee_rules !== undefined && { late_fee_rules: prefs.late_fee_rules }),
                    ...(prefs.auto_generate_rent !== undefined && { auto_generate_rent: prefs.auto_generate_rent }),
                    ...(prefs.auto_apply_late_fees !== undefined && { auto_apply_late_fees: prefs.auto_apply_late_fees }),
                    ...(prefs.auto_send_reminders !== undefined && { auto_send_reminders: prefs.auto_send_reminders }),
                    ...(prefs.auto_deactivate_days !== undefined && { auto_deactivate_days: prefs.auto_deactivate_days }),
                    ...(prefs.allow_partial_payments !== undefined && { allow_partial_payments: prefs.allow_partial_payments }),
                    ...(prefs.min_payment_amount !== undefined && { min_payment_amount: prefs.min_payment_amount }),
                    ...(prefs.reminder_email !== undefined && { reminder_email: prefs.reminder_email }),
                    ...(prefs.reminder_in_app !== undefined && { reminder_in_app: prefs.reminder_in_app }),
                    ...(prefs.reminder_day_1 !== undefined && { reminder_day_1: prefs.reminder_day_1 }),
                    ...(prefs.reminder_day_5 !== undefined && { reminder_day_5: prefs.reminder_day_5 }),
                    ...(prefs.reminder_day_10 !== undefined && { reminder_day_10: prefs.reminder_day_10 }),
                    ...(prefs.late_fee_notification !== undefined && { late_fee_notification: prefs.late_fee_notification }),
                    ...(prefs.owner_daily_summary !== undefined && { owner_daily_summary: prefs.owner_daily_summary }),
                    ...(prefs.auto_email_receipt !== undefined && { auto_email_receipt: prefs.auto_email_receipt }),
                    ...(prefs.receipt_format !== undefined && { receipt_format: prefs.receipt_format }),
                    ...(prefs.receipt_footer !== undefined && { receipt_footer: prefs.receipt_footer }),
                    ...(prefs.require_doc_approval !== undefined && { require_doc_approval: prefs.require_doc_approval }),
                    ...(prefs.allow_tenant_edits !== undefined && { allow_tenant_edits: prefs.allow_tenant_edits }),
                    ...(prefs.data_retention_months !== undefined && { data_retention_months: prefs.data_retention_months }),
                    ...(prefs.date_format !== undefined && { date_format: prefs.date_format }),
                    ...(prefs.time_format !== undefined && { time_format: prefs.time_format }),
                    ...(prefs.language !== undefined && { language: prefs.language }),
                };
                setPreferences(merged);
                setSavedPreferences(merged);
            } catch (e) {
                const detail = e?.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to load profile data'));
            } finally { setLoading(false); }
        };
        load();
    }, []);

    useEffect(() => {
        setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', activeTab); return p; });
    }, [activeTab, setSearchParams]);

    const showTempSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

    const updatePref = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    // Compute dirty state from diff with savedPreferences
    const hasDirtyPrefs = useMemo(() => {
        if (!savedPreferences) return false;
        return JSON.stringify(preferences) !== JSON.stringify(savedPreferences);
    }, [preferences, savedPreferences]);

    const saveOwner = async (e) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            const data = await ownerService.updateOwner({ name: ownerForm.name, phone: ownerForm.phone });
            const owner = data?.owner || {};
            setOwnerForm(prev => ({ ...prev, name: owner.name || prev.name, phone: owner.phone || prev.phone, email: owner.email || prev.email }));
            setIsEditingOwner(false);
            showTempSuccess('Owner profile updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update owner profile'));
        } finally { setSaving(false); }
    };

    const saveHostel = async (e) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            const data = await ownerService.updateHostel(hostelForm);
            const hostel = data?.hostel || {};
            setHostelForm({
                name: hostel.name || '', phone: hostel.phone || '', address: hostel.address || '',
                city: hostel.city || '', state: hostel.state || '', pincode: hostel.pincode || '',
                upi_id: hostel.upi_id || '', gst_number: hostel.gst_number || '', logo_url: hostel.logo_url || ''
            });
            setIsEditingHostel(false);
            showTempSuccess('Hostel details updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update hostel details'));
        } finally { setSaving(false); }
    };

    // Global save — sends all preferences in one PATCH
    const saveAllPreferences = async () => {
        setSaving(true); setError('');
        try {
            const planAccess = getPlanAccess(currentPlan);

            // 🔒 Block enabling automation on free plan before hitting the backend
            if (!planAccess.automation) {
                const tryingAutomation = (
                    preferences.auto_generate_rent !== savedPreferences?.auto_generate_rent ||
                    preferences.auto_apply_late_fees !== savedPreferences?.auto_apply_late_fees ||
                    preferences.auto_send_reminders !== savedPreferences?.auto_send_reminders
                ) && (
                    preferences.auto_generate_rent === true ||
                    preferences.auto_apply_late_fees === true ||
                    preferences.auto_send_reminders === true
                );

                if (tryingAutomation) {
                    setUpgradeModal({ feature: 'automation', requiredPlan: 'starter' });
                    setSaving(false);
                    return;
                }
            }

            // Sync UPI to hostel too
            if (preferences.upi_id !== (savedPreferences?.upi_id || '')) {
                await ownerService.updateHostel({ upi_id: preferences.upi_id });
            }
            const preferencePayload = {
                currency: preferences.currency, rent_cycle: preferences.rent_cycle,
                receipt_prefix: preferences.receipt_prefix, timezone: preferences.timezone,
                auto_rent_day: preferences.auto_rent_day, phonepe_merchant_id: preferences.phonepe_merchant_id,
                due_day: preferences.due_day, late_fee_type: preferences.late_fee_type,
                late_fee_amount: preferences.late_fee_amount, late_fee_percentage: preferences.late_fee_percentage,
                late_fee_after_days: preferences.late_fee_after_days, max_late_fee: preferences.max_late_fee,
                grace_days: preferences.grace_days ?? 0, late_fee_rules: preferences.late_fee_rules || [],
                auto_generate_rent: preferences.auto_generate_rent, auto_apply_late_fees: preferences.auto_apply_late_fees,
                auto_send_reminders: preferences.auto_send_reminders, auto_deactivate_days: preferences.auto_deactivate_days,
                auto_email_receipt: preferences.auto_email_receipt, receipt_format: preferences.receipt_format,
                receipt_footer: preferences.receipt_footer, require_doc_approval: preferences.require_doc_approval,
                allow_tenant_edits: preferences.allow_tenant_edits, data_retention_months: preferences.data_retention_months,
                date_format: preferences.date_format, time_format: preferences.time_format, language: preferences.language,
                reminder_email: preferences.reminder_email, reminder_in_app: preferences.reminder_in_app,
                reminder_whatsapp: preferences.reminder_whatsapp, reminder_day_1: preferences.reminder_day_1,
                reminder_day_5: preferences.reminder_day_5, reminder_day_10: preferences.reminder_day_10,
                late_fee_notification: preferences.late_fee_notification, owner_daily_summary: preferences.owner_daily_summary,
                allow_partial_payments: preferences.allow_partial_payments, min_payment_amount: preferences.min_payment_amount,
            };
            await ownerService.updatePreferences(preferencePayload);
            setSavedPreferences({ ...preferences });
            updatePreferencesLocal({ ...preferences });
            setDirtyModules(new Set());
            showTempSuccess('All preferences saved');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to save preferences'));
        } finally { setSaving(false); }
    };

    const uploadLogo = async (file) => {
        setSaving(true); setError('');
        try {
            const response = await ownerService.uploadLogo(file);
            const logoUrl = response?.logo_url || '';
            setHostelForm(prev => ({ ...prev, logo_url: logoUrl }));
            window.dispatchEvent(new CustomEvent('owner-branding-updated', { detail: { logoUrl } }));
            showTempSuccess('Hostel logo updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to upload hostel logo'));
        } finally { setSaving(false); }
    };

    const removeLogo = async () => {
        setSaving(true); setError('');
        try {
            await ownerService.removeLogo();
            setHostelForm(prev => ({ ...prev, logo_url: '' }));
            window.dispatchEvent(new CustomEvent('owner-branding-updated', { detail: { logoUrl: '' } }));
            showTempSuccess('Hostel logo removed');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to remove hostel logo'));
        } finally { setSaving(false); }
    };

    // FIX #1: Toggle individual modules independently
    const toggleModule = (key) => {
        setOpenModules(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <span className="text-sm text-slate-400 font-medium">Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="space-y-4 pb-24 max-w-2xl mx-auto">
            {/* Header */}
            <div className="px-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage your hostel, billing, and automation.</p>
            </div>

            {/* Tab Switcher */}
            <div className="bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm flex gap-1 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all ${active
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'}`}>
                            <Icon size={15} /> <span className="whitespace-nowrap">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Feedback */}
            {error && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> {success}
                </div>
            )}

            {/* ─── Owner Profile Tab ─── */}
            {activeTab === 'owner' && (
                <form onSubmit={saveOwner} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-slate-800">Personal Information</h3>
                        {!isEditingOwner && (
                            <button type="button" onClick={() => setIsEditingOwner(true)} className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg">
                                Edit Profile
                            </button>
                        )}
                    </div>
                    <Field label="Full Name" value={ownerForm.name} onChange={(v) => setOwnerForm({ ...ownerForm, name: v })} disabled={!isEditingOwner} required />
                    <Field label="Email (read-only)" value={ownerForm.email} onChange={() => { }} disabled />
                    <Field label="Phone" value={ownerForm.phone} onChange={(v) => setOwnerForm({ ...ownerForm, phone: v })} disabled={!isEditingOwner} />
                    
                    {isEditingOwner && (
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-50 mt-4">
                            <button type="button" onClick={() => setIsEditingOwner(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                                Cancel
                            </button>
                            <SaveButton saving={saving} />
                        </div>
                    )}
                </form>
            )}

            {/* ─── Hostel Details Tab ─── */}
            {activeTab === 'hostel' && (
                <form onSubmit={saveHostel} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-slate-800">Property Information</h3>
                        {!isEditingHostel && (
                            <button type="button" onClick={() => setIsEditingHostel(true)} className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg">
                                Edit Details
                            </button>
                        )}
                    </div>
                    
                    <ProfileLogoUploader logoUrl={hostelForm.logo_url} onUpload={uploadLogo} onRemove={removeLogo} disabled={saving || (!isEditingHostel && !!hostelForm.logo_url)} />
                    
                    <Field label="Hostel Name" value={hostelForm.name} onChange={(v) => setHostelForm({ ...hostelForm, name: v })} disabled={!isEditingHostel} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Hostel Phone" value={hostelForm.phone} onChange={(v) => setHostelForm({ ...hostelForm, phone: v })} disabled={!isEditingHostel} required />
                        <Field label="Pincode" value={hostelForm.pincode} onChange={(v) => setHostelForm({ ...hostelForm, pincode: v })} disabled={!isEditingHostel} required />
                    </div>
                    <Field label="Address" value={hostelForm.address} onChange={(v) => setHostelForm({ ...hostelForm, address: v })} disabled={!isEditingHostel} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="City" value={hostelForm.city} onChange={(v) => setHostelForm({ ...hostelForm, city: v })} disabled={!isEditingHostel} required />
                        <Field label="State" value={hostelForm.state} onChange={(v) => setHostelForm({ ...hostelForm, state: v })} disabled={!isEditingHostel} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="UPI ID" value={hostelForm.upi_id} onChange={(v) => setHostelForm({ ...hostelForm, upi_id: v })} disabled={!isEditingHostel} />
                        <Field label="GST Number" value={hostelForm.gst_number} onChange={(v) => setHostelForm({ ...hostelForm, gst_number: v })} disabled={!isEditingHostel} />
                    </div>

                    {isEditingHostel && (
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-50 mt-4">
                            <button type="button" onClick={() => setIsEditingHostel(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                                Cancel
                            </button>
                            <SaveButton saving={saving} />
                        </div>
                    )}
                </form>
            )}

            {/* ─── Preferences Tab ─── */}
            {activeTab === 'preferences' && (
                <div className="space-y-2">
                    {prefModules.map((mod) => {
                        const Icon = mod.icon;
                        const isOpen = openModules.has(mod.key);
                        return (
                            <div key={mod.key} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${isOpen ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-100'}`}>
                                <button type="button" onClick={() => toggleModule(mod.key)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 active:bg-slate-100/60 transition-colors">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold text-slate-800">{mod.label}</span>
                                        <p className="text-xs text-slate-400 truncate">{mod.desc}</p>
                                    </div>
                                    {isOpen ? <ChevronDown size={18} className="text-indigo-400" /> : <ChevronRight size={18} className="text-slate-300" />}
                                </button>

                                {isOpen && (
                                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                                        {mod.key === 'billing' && <BillingModule prefs={preferences} updatePref={updatePref} />}
                                        {mod.key === 'payments' && <PaymentsModule prefs={preferences} updatePref={updatePref} />}
                                        {mod.key === 'notifications' && <NotificationsModule prefs={preferences} updatePref={updatePref} reminderCredits={reminderCredits} cronStopped={cronStopped} autoTopup={autoTopup} onAutoTopupChange={setAutoTopup} onBuyCredits={(t) => setBuyCreditsModal(t || 'empty')} onCreditsRefresh={(c) => setReminderCredits(c)} />}
                                        {mod.key === 'automation' && <AutomationModule prefs={preferences} updatePref={updatePref} plan={currentPlan} onLockedClick={(feature, reqPlan) => setUpgradeModal({ feature, requiredPlan: reqPlan })} />}
                                        {mod.key === 'receipts' && <ReceiptsModule prefs={preferences} updatePref={updatePref} />}
                                        {mod.key === 'security' && <SecurityModule prefs={preferences} updatePref={updatePref} />}
                                        {mod.key === 'system' && <SystemModule prefs={preferences} updatePref={updatePref} />}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* FIX #2: Global sticky save bar */}
                    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${hasDirtyPrefs ? 'translate-y-0' : 'translate-y-full'}`}>
                        <div className="max-w-2xl mx-auto px-4 py-3">
                            <div className="bg-slate-900 text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-2xl shadow-slate-900/30">
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="font-medium">Unsaved changes</span>
                                </div>
                                <button onClick={saveAllPreferences} disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-sm font-semibold transition-colors disabled:opacity-60">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'Saving...' : 'Save All'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Upgrade Modal (plan gate) */}
        {upgradeModal && (
            <UpgradeModal
                feature={upgradeModal.feature}
                requiredPlan={upgradeModal.requiredPlan}
                onClose={() => setUpgradeModal(null)}
            />
        )}

        {/* Buy Reminders Modal (credit gate) */}
        {buyCreditsModal && (
            <BuyRemindersModal
                trigger={buyCreditsModal}
                currentCredits={reminderCredits}
                onClose={() => setBuyCreditsModal(null)}
            />
        )}

        {/* Retry toast after payment return */}
        {retryToast && (
            <div
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl cursor-pointer max-w-xs w-full"
                onClick={() => {
                    setRetryToast(null);
                    if (retryToast.action === 'send_test_reminder') {
                        window.__pendingRetryReminder = true;
                    }
                }}
            >
                <span className="flex-1">{retryToast.label}</span>
                <button onClick={(e) => { e.stopPropagation(); setRetryToast(null); }}
                    className="text-white/60 hover:text-white transition">
                    <X size={14} />
                </button>
            </div>
        )}
    </>
    );
}

// ──── MODULE PANELS ────────────────────────────────────────────

function BillingModule({ prefs, updatePref }) {
    // ── Rules Engine State ──
    // Migrate legacy flat prefs → rules array on mount
    const billingConfig = useMemo(() => migrateLegacyPrefs(prefs), [
        prefs.late_fee_rules, prefs.late_fee_type, prefs.late_fee_amount,
        prefs.late_fee_percentage, prefs.late_fee_after_days, prefs.max_late_fee,
        prefs.grace_days, prefs.auto_rent_day, prefs.due_day,
    ]);

    const [whatIfRent, setWhatIfRent] = useState(8000);
    const [whatIfDelay, setWhatIfDelay] = useState(10);

    // ── Rules CRUD ──
    const rules = billingConfig.late_fee_rules || [];

    const addRule = () => {
        if (rules.length >= 5) return;
        const newRule = createDefaultRule();
        updatePref('late_fee_rules', [...rules, newRule]);
        // Also sync legacy fields for backward compat
        syncLegacyFromRules([...rules, newRule], prefs, updatePref);
    };

    const removeRule = (ruleId) => {
        const updated = rules.filter(r => r.id !== ruleId);
        updatePref('late_fee_rules', updated);
        syncLegacyFromRules(updated, prefs, updatePref);
    };

    const updateRule = (ruleId, field, value) => {
        const updated = rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r);
        updatePref('late_fee_rules', updated);
        syncLegacyFromRules(updated, prefs, updatePref);
    };

    // ── Live Simulation ──
    const simulation = useMemo(() => {
        if (rules.filter(r => r.enabled).length === 0) return null;
        return simulateBilling(billingConfig, whatIfRent, 30);
    }, [billingConfig, whatIfRent]);

    // ── What-If ──
    const whatIfResult = useMemo(() => {
        return calculateWhatIf(billingConfig, whatIfRent, whatIfDelay);
    }, [billingConfig, whatIfRent, whatIfDelay]);

    return (
        <div className="space-y-4">
            {/* ── Section 1: Core Settings ── */}
            <div className="grid grid-cols-2 gap-3">
                <SelectField label="Rent Cycle" value={prefs.rent_cycle}
                    options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' }, { value: 'YEARLY', label: 'Yearly' }]}
                    onChange={(v) => updatePref('rent_cycle', v)} />
                <SelectField label="Generation Day" value={String(prefs.auto_rent_day)}
                    options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}${getDaySuffix(i + 1)}` }))}
                    onChange={(v) => updatePref('auto_rent_day', Number(v))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <SelectField label="Due Day" value={String(prefs.due_day)}
                    options={[{ value: '5', label: '5th of month' }, { value: '10', label: '10th of month' }, { value: '15', label: '15th of month' }, { value: '20', label: '20th of month' }]}
                    onChange={(v) => updatePref('due_day', Number(v))} />
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Grace Period</label>
                    <div className="flex items-center gap-2">
                        <input type="range" min="0" max="10" value={prefs.grace_days ?? 0}
                            onChange={(e) => updatePref('grace_days', Number(e.target.value))}
                            className="flex-1 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                        <span className="text-sm font-bold text-indigo-600 min-w-[40px] text-right">{prefs.grace_days ?? 0}d</span>
                    </div>
                </div>
            </div>

            {/* ── Section 2: Late Fee Rules Builder ── */}
            <Divider label="Late Fee Rules (cumulative)" />
            {rules.length > 1 && (
                <p className="text-[11px] text-slate-400 -mt-1 px-0.5">All enabled rules stack — each rule applies independently.</p>
            )}

            {rules.length === 0 && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                    <p className="text-sm text-slate-400">No late fee rules configured</p>
                    <p className="text-xs text-slate-300 mt-1">Add rules to automatically charge penalties for late payments</p>
                </div>
            )}

            <div className="space-y-2.5">
                {rules.map((rule, idx) => (
                    <div key={rule.id} className={`border rounded-xl p-3.5 transition-all ${rule.enabled
                        ? 'bg-white border-slate-200 shadow-sm'
                        : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Rule {idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => updateRule(rule.id, 'enabled', !rule.enabled)}
                                    className="p-1 rounded-md hover:bg-slate-100 transition">
                                    {rule.enabled
                                        ? <ToggleRight size={20} className="text-indigo-600" />
                                        : <ToggleLeft size={20} className="text-slate-300" />}
                                </button>
                                <button type="button" onClick={() => removeRule(rule.id)}
                                    className="p-1 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type</label>
                                <select value={rule.type} onChange={(e) => updateRule(rule.id, 'type', e.target.value)}
                                    className="w-full px-2.5 py-2 rounded-lg border text-xs font-medium bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none">
                                    <option value="flat">Flat Amount</option>
                                    <option value="per_day">Per Day Amount</option>
                                    <option value="percentage">% of Rent</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    {rule.type === 'percentage' ? 'Percent' : 'Amount'}
                                </label>
                                <input type="number" min="0"
                                    value={rule.type === 'percentage' ? (rule.value ?? 5) : (rule.amount ?? 200)}
                                    onChange={(e) => updateRule(rule.id, rule.type === 'percentage' ? 'value' : 'amount', Number(e.target.value))}
                                    className="w-full px-2.5 py-2 rounded-lg border text-xs font-medium bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">After Days</label>
                                <input type="number" min="1" max="30" value={rule.after_days ?? 5}
                                    onChange={(e) => updateRule(rule.id, 'after_days', Number(e.target.value))}
                                    className="w-full px-2.5 py-2 rounded-lg border text-xs font-medium bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" />
                            </div>
                        </div>
                        {/* Rule human-readable summary */}
                        <p className="text-[11px] text-slate-400 mt-2 italic">
                            {rule.type === 'flat' && `Charge ${formatCurrency(rule.amount || 0, prefs)} once, ${rule.after_days} days after due date`}
                            {rule.type === 'per_day' && `Charge ${formatCurrency(rule.amount || 0, prefs)} every day starting ${rule.after_days} days after due date`}
                            {rule.type === 'percentage' && `Charge ${rule.value || 0}% of rent, ${rule.after_days} days after due date`}
                        </p>
                    </div>
                ))}
            </div>

            {rules.length < 5 && (
                <button type="button" onClick={addRule}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all active:scale-[0.98]">
                    <Plus size={16} /> Add Rule
                </button>
            )}

            {rules.length > 0 && (
                <Field label="Maximum Late Fee Cap" value={prefs.max_late_fee ?? 0} type="number"
                    onChange={(v) => updatePref('max_late_fee', Number(v))} />
            )}

            {/* ── Section 3: Live Simulation Timeline ── */}
            {simulation && (
                <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100 rounded-xl px-4 py-3.5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-indigo-700 font-semibold text-sm flex items-center gap-1.5">
                            <Calendar size={14} /> Billing Preview
                            <span className="text-[9px] font-medium text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Estimate</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-slate-400">Rent:</span>
                            <input type="number" min="1000" step="500" value={whatIfRent}
                                onChange={(e) => setWhatIfRent(Number(e.target.value) || 8000)}
                                className="w-20 px-2 py-1 rounded-md border border-indigo-200 text-xs font-bold text-indigo-700 bg-white/80 outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>
                    </div>
                    <div className="space-y-0">
                        {simulation.map((step, i) => {
                            const dotColor = {
                                slate: 'bg-slate-400', indigo: 'bg-indigo-500', amber: 'bg-amber-500',
                                orange: 'bg-orange-500', rose: 'bg-rose-500',
                            }[step.color] || 'bg-slate-400';
                            const textColor = ['amber', 'orange', 'rose'].includes(step.color) ? 'text-amber-700' : 'text-slate-700';
                            return (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${dotColor} ${step.type === 'late_fee' ? 'animate-pulse' : ''}`} />
                                        {i < simulation.length - 1 && <div className="w-px h-7 bg-indigo-200/50" />}
                                    </div>
                                    <div className="pb-1.5 flex-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-bold text-slate-600">{step.label}</span>
                                            <span className="text-xs text-slate-400 flex-1">{step.description}</span>
                                        </div>
                                        <span className={`text-sm font-bold ${textColor}`}>
                                            {formatCurrency(step.running_total, prefs)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Section 4: What-If Calculator ── */}
            {rules.filter(r => r.enabled).length > 0 && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl px-4 py-4 text-white">
                    <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                        <Zap size={14} className="text-amber-400" /> What-If Calculator
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rent Amount</label>
                            <input type="number" min="500" step="500" value={whatIfRent}
                                onChange={(e) => setWhatIfRent(Number(e.target.value) || 8000)}
                                className="w-full px-2.5 py-2 rounded-lg border text-xs font-medium bg-slate-700/50 border-slate-600 text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Days Delayed</label>
                            <input type="number" min="0" max="60" value={whatIfDelay}
                                onChange={(e) => setWhatIfDelay(Number(e.target.value) || 0)}
                                className="w-full px-2.5 py-2 rounded-lg border text-xs font-medium bg-slate-700/50 border-slate-600 text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
                        </div>
                    </div>

                    {/* Result */}
                    <div className="bg-slate-700/40 rounded-lg px-3.5 py-3">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-xs text-slate-400">Total Payable</span>
                            <span className="text-xl font-bold text-white">
                                {formatCurrency(whatIfResult.totalPayable, prefs)}
                            </span>
                        </div>
                        {whatIfResult.graceDaysApplied > 0 && (
                            <p className="text-[11px] text-emerald-400 mb-1.5">
                                {whatIfResult.effectiveDelay === 0 && whatIfDelay > 0
                                    ? `✓ Within ${whatIfResult.graceDaysApplied}-day grace period — no penalties`
                                    : `Grace: ${whatIfResult.graceDaysApplied}d → effective delay: ${whatIfResult.effectiveDelay}d`}
                            </p>
                        )}
                        {whatIfResult.breakdown.length > 0 ? (
                            <div className="space-y-1">
                                {whatIfResult.breakdown.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300">{b.desc}</span>
                                    </div>
                                ))}
                                {whatIfResult.capApplied && (
                                    <p className="text-[11px] text-rose-400 font-medium mt-1">⚠ Cap applied — max {formatCurrency(prefs.max_late_fee, prefs)}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                {whatIfDelay === 0 ? 'No delay — full rent only' : 'No penalties triggered yet'}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Sync rules back to legacy flat fields for backward compatibility */
function syncLegacyFromRules(rules, prefs, updatePref) {
    if (!rules || rules.length === 0) {
        updatePref('late_fee_type', 'none');
        return;
    }
    // Use first enabled rule for legacy fields
    const primary = rules.find(r => r.enabled) || rules[0];
    updatePref('late_fee_type', primary.type === 'per_day' ? 'flat' : primary.type);
    updatePref('late_fee_after_days', primary.after_days);
    if (primary.type === 'percentage') {
        updatePref('late_fee_percentage', primary.value || 5);
    } else {
        updatePref('late_fee_amount', primary.amount || 200);
    }
}

function PaymentsModule({ prefs, updatePref }) {
    return (
        <div className="space-y-3">
            <Field label="Hostel UPI ID" value={prefs.upi_id || ''} onChange={(v) => updatePref('upi_id', v)} placeholder="yourname@upi" />
            <Field label="PhonePe Merchant ID" value={prefs.phonepe_merchant_id || ''}
                onChange={(v) => updatePref('phonepe_merchant_id', v)} placeholder="Optional" />
            <ToggleField label="Allow Partial Payments" desc="Let tenants pay less than full amount"
                value={prefs.allow_partial_payments} onChange={(v) => updatePref('allow_partial_payments', v)} />
            {prefs.allow_partial_payments && (
                <Field label="Minimum Payment" value={prefs.min_payment_amount} type="number"
                    onChange={(v) => updatePref('min_payment_amount', Number(v))} />
            )}
        </div>
    );
}

function NotificationsModule({ prefs, updatePref, reminderCredits, cronStopped, autoTopup, onAutoTopupChange, onBuyCredits, onCreditsRefresh }) {
    const [testSending, setTestSending] = useState(false);
    const [testSent, setTestSent] = useState(false);
    const [testResult, setTestResult] = useState('');
    const [togglingAutoTopup, setTogglingAutoTopup] = useState(false);

    const noCredits  = reminderCredits !== null && reminderCredits <= 0;
    const lowCredits = reminderCredits !== null && reminderCredits > 0 && reminderCredits <= 20;

    const sendTestReminder = async () => {
        setTestSending(true);
        setTestResult('');
        try {
            const res = await ownerService.sendTestReminder('DUE_SOON');
            setTestSent(true);
            setTestResult(res?.message || 'Test reminder sent!');
        } catch (e) {
            const errData = e?.response?.data;
            if (errData?.error === 'NO_REMINDERS_LEFT' || errData?.code === 'NO_REMINDERS_LEFT') {
                sessionStorage.setItem('pending_reminder_action', 'send_test_reminder');
                onBuyCredits('empty');
            } else if (errData?.code === 'RATE_LIMIT_EXCEEDED') {
                setTestResult('Rate limit: max 10 reminders per minute. Please wait.');
            } else {
                const detail = errData?.detail;
                setTestResult(typeof detail === 'string' ? detail : (detail?.message || 'Failed to send test reminder'));
            }
        } finally {
            setTestSending(false);
            setTimeout(() => { setTestSent(false); setTestResult(''); }, 5000);
        }
    };

    const handleAutoTopup = async (enabled) => {
        setTogglingAutoTopup(true);
        try {
            await addonService.setAutoTopup(enabled, 'settings');
            onAutoTopupChange(enabled);
        } catch {
            // silently revert
        } finally {
            setTogglingAutoTopup(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Cron-stopped critical alert (auto reminders paused) */}
            {cronStopped && (
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-300 rounded-xl px-3.5 py-3">
                    <AlertTriangle size={15} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-rose-800">⚠️ Automatic reminders are paused</p>
                        <p className="text-xs text-rose-600 mt-0.5">The daily reminder cron stopped because credits ran out. Tenants may be missing payment reminders.</p>
                    </div>
                    <button onClick={() => onBuyCredits('empty')}
                        className="flex-shrink-0 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap">
                        Fix Now
                    </button>
                </div>
            )}

            {/* Zero-credit banner */}
            {noCredits && !cronStopped && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                    <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">No reminder credits left</p>
                        <p className="text-xs text-amber-600 mt-0.5">Buy a pack to continue sending reminders to tenants.</p>
                    </div>
                    <button onClick={() => onBuyCredits('empty')}
                        className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap">
                        Buy Credits
                    </button>
                </div>
            )}

            {/* Low-credit nudge */}
            {lowCredits && (
                <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5">
                    <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                    <p className="text-xs text-orange-700 flex-1">
                        Only <span className="font-bold">{reminderCredits}</span> credits left — ~{Math.floor(reminderCredits / 10)} days of reminders
                    </p>
                    <button onClick={() => onBuyCredits('low')}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2 whitespace-nowrap transition">
                        Top up
                    </button>
                </div>
            )}

            {/* Healthy credit balance */}
            {reminderCredits !== null && reminderCredits > 20 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-xs font-medium text-emerald-700">
                        <span className="font-bold">{reminderCredits}</span> credits · ~{Math.floor(reminderCredits / 10)} days of reminders
                    </p>
                    <button onClick={() => onBuyCredits('manual')} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition">
                        + Buy more
                    </button>
                </div>
            )}

            {/* Auto-topup toggle */}
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-3.5 py-3">
                <div className="flex-1">
                    <p className="text-sm font-semibold text-violet-800">Auto top-up</p>
                    <p className="text-xs text-violet-500 mt-0.5">Automatically buy 200 credits when balance hits 0</p>
                </div>
                <button type="button" disabled={togglingAutoTopup}
                    onClick={() => handleAutoTopup(!autoTopup)}
                    className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 disabled:opacity-50 ${autoTopup ? 'bg-violet-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${autoTopup ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
            </div>

            <Divider label="Channels" />
            <ToggleField label="Email" desc="Send reminders via email" value={prefs.reminder_email}
                onChange={(v) => updatePref('reminder_email', v)} />
            <ToggleField label="In-App" desc="Show in tenant dashboard" value={prefs.reminder_in_app}
                onChange={(v) => updatePref('reminder_in_app', v)} />
            <div className="relative">
                <ToggleField label="WhatsApp" desc="Send via WhatsApp" value={false} onChange={() => {}} disabled />
                <span className="absolute top-2.5 right-12 px-2 py-0.5 rounded-md bg-violet-100 text-violet-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Lock size={9} /> Coming Soon
                </span>
            </div>

            <Divider label="Reminder Schedule" />
            <ToggleField label="Day 1 — Gentle Reminder" value={prefs.reminder_day_1}
                onChange={(v) => updatePref('reminder_day_1', v)} />
            <ToggleField label="Day 5 — Warning" value={prefs.reminder_day_5}
                onChange={(v) => updatePref('reminder_day_5', v)} />
            <ToggleField label="Day 10 — Final Notice" value={prefs.reminder_day_10}
                onChange={(v) => updatePref('reminder_day_10', v)} />

            <Divider label="Owner Alerts" />
            <ToggleField label="Late Fee Notification" desc="Get notified when late fees apply" value={prefs.late_fee_notification}
                onChange={(v) => updatePref('late_fee_notification', v)} />
            <ToggleField label="Daily Summary" desc="Daily email with collection stats" value={prefs.owner_daily_summary}
                onChange={(v) => updatePref('owner_daily_summary', v)} />

            {/* Test Reminder — disabled only when credits = 0 */}
            <div className="pt-1 space-y-2">
                {noCredits ? (
                    <button type="button"
                        onClick={() => { sessionStorage.setItem('pending_reminder_action', 'send_test_reminder'); onBuyCredits('empty'); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-all">
                        <CreditCard size={14} />
                        Buy Credits to Send Test Reminder
                    </button>
                ) : (
                    <button type="button" onClick={sendTestReminder}
                        disabled={testSending || testSent}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            testSent
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:bg-slate-200'
                        } disabled:opacity-60`}>
                        {testSending ? <Loader2 size={14} className="animate-spin" />
                            : testSent ? <CheckCircle2 size={14} />
                                : <Send size={14} />}
                        {testSending ? 'Sending...' : testSent ? (testResult || 'Sent!') : 'Send Test Reminder to Myself'}
                    </button>
                )}
                {testResult && !testSent && !noCredits && (
                    <p className="text-xs text-rose-600 text-center">{testResult}</p>
                )}
            </div>
        </div>
    );
}

function AutomationModule({ prefs, updatePref, plan, onLockedClick }) {
    const planAccess = getPlanAccess(plan);
    const hasAutomation = planAccess.automation;

    const handleLockedToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onLockedClick('automation', 'starter');
    };

    return (
        <div className="space-y-3">
            {!hasAutomation && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                    <ShieldAlert size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">Automation requires Starter plan</p>
                        <p className="text-xs text-amber-600 mt-0.5">Upgrade to automatically generate rent, apply late fees, and send scheduled reminders.</p>
                    </div>
                    <button onClick={() => onLockedClick('automation', 'starter')}
                        className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap">
                        Upgrade
                    </button>
                </div>
            )}
            <LockedToggleField
                label="Auto Generate Rent"
                desc="Monthly rent entries created automatically"
                value={prefs.auto_generate_rent}
                locked={!hasAutomation}
                onChange={(v) => updatePref('auto_generate_rent', v)}
                onLockedClick={handleLockedToggle}
            />
            <LockedToggleField
                label="Auto Apply Late Fees"
                desc="Late fees added after overdue period"
                value={prefs.auto_apply_late_fees}
                locked={!hasAutomation}
                onChange={(v) => updatePref('auto_apply_late_fees', v)}
                onLockedClick={handleLockedToggle}
            />
            <LockedToggleField
                label="Auto Send Reminders"
                desc="Overdue reminders sent on schedule"
                value={prefs.auto_send_reminders}
                locked={!hasAutomation}
                onChange={(v) => updatePref('auto_send_reminders', v)}
                onLockedClick={handleLockedToggle}
            />
            <SelectField label="Auto-Deactivate After" value={String(prefs.auto_deactivate_days)}
                options={[
                    { value: '0', label: 'Disabled' }, { value: '30', label: '30 days unpaid' },
                    { value: '60', label: '60 days unpaid' }, { value: '90', label: '90 days unpaid' },
                ]}
                onChange={(v) => updatePref('auto_deactivate_days', Number(v))} />
            {prefs.auto_deactivate_days > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    Tenant will be deactivated after {prefs.auto_deactivate_days} days of unpaid rent.
                </div>
            )}
        </div>
    );
}

function ReceiptsModule({ prefs, updatePref }) {
    return (
        <div className="space-y-3">
            <Field label="Receipt Prefix" value={prefs.receipt_prefix}
                onChange={(v) => updatePref('receipt_prefix', v.toUpperCase().replace(/\s+/g, ''))} />
            <SelectField label="Number Format" value={prefs.receipt_format}
                options={[
                    { value: 'PREFIX-YEAR-SEQ', label: 'HMS-2026-0001' },
                    { value: 'PREFIX-SEQ', label: 'HMS-0001' },
                    { value: 'YEAR-SEQ', label: '2026-0001' },
                ]}
                onChange={(v) => updatePref('receipt_format', v)} />
            <ToggleField label="Auto Email Receipt" desc="Email receipt upon payment confirmation"
                value={prefs.auto_email_receipt} onChange={(v) => updatePref('auto_email_receipt', v)} />
            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Custom Footer</label>
                <textarea value={prefs.receipt_footer} onChange={(e) => updatePref('receipt_footer', e.target.value)}
                    placeholder="Thank you for staying with us" rows={2}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none" />
            </div>
        </div>
    );
}

function SecurityModule({ prefs, updatePref }) {
    return (
        <div className="space-y-3">
            <ToggleField label="Require Document Approval" desc="Owner must approve uploaded documents"
                value={prefs.require_doc_approval} onChange={(v) => updatePref('require_doc_approval', v)} />
            <ToggleField label="Allow Tenant Profile Edits" desc="Tenants can edit their own profile details"
                value={prefs.allow_tenant_edits} onChange={(v) => updatePref('allow_tenant_edits', v)} />
            <SelectField label="Data Retention" value={String(prefs.data_retention_months)}
                options={[
                    { value: '0', label: 'Forever' }, { value: '12', label: '12 months' },
                    { value: '24', label: '24 months' }, { value: '36', label: '36 months' },
                ]}
                onChange={(v) => updatePref('data_retention_months', Number(v))} />
        </div>
    );
}

function SystemModule({ prefs, updatePref }) {
    const previewValue = useMemo(
        () => formatDateTime(new Date(), prefs),
        [prefs]
    );

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <SelectField label="Currency" value={prefs.currency}
                    options={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }, { value: 'EUR', label: '€ EUR' }, { value: 'GBP', label: '£ GBP' }]}
                    onChange={(v) => updatePref('currency', v)} />
                <SelectField label="Timezone" value={prefs.timezone}
                    options={[
                        { value: 'Asia/Kolkata', label: 'IST (Kolkata)' }, { value: 'Asia/Dubai', label: 'GST (Dubai)' },
                        { value: 'UTC', label: 'UTC' }, { value: 'America/New_York', label: 'EST (New York)' },
                    ]}
                    onChange={(v) => updatePref('timezone', v)} />
            </div>
            <SelectField label="Date Format" value={prefs.date_format}
                options={[{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]}
                onChange={(v) => updatePref('date_format', v)} />
            <SelectField label="Time Format" value={prefs.time_format}
                options={[{ value: '12h', label: '12 Hour (02:30 PM)' }, { value: '24h', label: '24 Hour (14:30)' }]}
                onChange={(v) => updatePref('time_format', v)} />
            <SelectField label="Language" value={prefs.language}
                options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }]}
                onChange={(v) => updatePref('language', v)} />
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">{previewValue}</p>
            </div>
        </div>
    );
}

// ──── SHARED COMPONENTS ────────────────────────────────────────

function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    const last = day % 10;
    if (last === 1) return 'st'; if (last === 2) return 'nd'; if (last === 3) return 'rd';
    return 'th';
}

function Field({ label, value, onChange, required = false, disabled = false, type = 'text', placeholder = '' }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
                required={required} disabled={disabled} placeholder={placeholder}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${disabled
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`} />
        </div>
    );
}

function SelectField({ label, value, onChange, options }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none">
                {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
        </div>
    );
}

function ToggleField({ label, desc, value, onChange, disabled = false }) {
    return (
        <button type="button" disabled={disabled} onClick={() => onChange(!value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${value ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50/50 border-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 active:bg-slate-100'}`}>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                {desc && <p className="text-xs text-slate-400 truncate">{desc}</p>}
            </div>
            {value ? <ToggleRight size={24} className="text-indigo-600 flex-shrink-0" /> : <ToggleLeft size={24} className="text-slate-300 flex-shrink-0" />}
        </button>
    );
}

function SaveButton({ saving }) {
    return (
        <button type="submit" disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Changes'}
        </button>
    );
}

// ──── LOCKED TOGGLE FIELD (plan-gated) ──────────────────────────────────────

function LockedToggleField({ label, desc, value, locked, onChange, onLockedClick }) {
    if (locked) {
        return (
            <button type="button" onClick={onLockedClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-amber-50/40 hover:border-amber-200 transition-all group">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    {desc && <p className="text-xs text-slate-400 truncate">{desc}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 group-hover:bg-amber-200 px-1.5 py-0.5 rounded transition">
                        STARTER+
                    </span>
                    <Lock size={14} className="text-slate-400" />
                </div>
            </button>
        );
    }
    return <ToggleField label={label} desc={desc} value={value} onChange={onChange} />;
}

// ──── UPGRADE MODAL ──────────────────────────────────────────────────────────

const UPGRADE_COPY = {
    automation: {
        title: 'Unlock Automation',
        body: 'Automatically generate rent entries, apply late fees on schedule, and dispatch overdue reminders — all without manual effort.',
        cta: 'Upgrade to Starter',
    },
};

function UpgradeModal({ feature, requiredPlan, onClose }) {
    const copy = UPGRADE_COPY[feature] || {
        title: 'Upgrade Required',
        body: 'This feature requires a higher plan.',
        cta: `Upgrade to ${requiredPlan}`,
    };

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 pb-6 sm:pb-0"
            onClick={handleBackdrop}
        >
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 pt-6 pb-8 relative">
                    <button onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition">
                        <X size={14} />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                        <Zap size={24} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">{copy.title}</h2>
                    <p className="text-sm text-indigo-200 mt-1 leading-relaxed">{copy.body}</p>
                </div>
                {/* Plan badge */}
                <div className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Zap size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Required plan</p>
                            <p className="text-sm font-bold text-indigo-700 capitalize">{requiredPlan} Plan</p>
                        </div>
                    </div>
                </div>
                {/* Actions */}
                <div className="px-6 py-4 flex flex-col gap-2">
                    <a href="/owner/billing"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
                        {copy.cta} <ArrowRight size={16} />
                    </a>
                    <button onClick={onClose}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition">
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}

function Divider({ label }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <div className="flex-1 h-px bg-slate-100" />
        </div>
    );
}
