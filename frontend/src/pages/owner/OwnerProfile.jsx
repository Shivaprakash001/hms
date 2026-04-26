import React, { useEffect, useState, useMemo } from 'react';
import { User, Building2, Settings, Save, Loader2, ChevronDown, ChevronRight, Receipt, Bell, CreditCard, Shield, Zap, Globe, IndianRupee, Calendar, Clock, FileText, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Send, Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ownerService } from '../../api/services';
import ProfileLogoUploader from '../../components/owner/ProfileLogoUploader';

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
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabFromUrl && tabs.some(t => t.key === tabFromUrl) ? tabFromUrl : 'owner');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [ownerForm, setOwnerForm] = useState({ name: '', email: '', phone: '' });
    const [hostelForm, setHostelForm] = useState({
        name: '', phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: '', logo_url: ''
    });

    const [preferences, setPreferences] = useState({
        currency: 'INR', rent_cycle: 'MONTHLY', auto_rent_day: 1, due_day: 5,
        late_fee_type: 'none', late_fee_amount: 200, late_fee_percentage: 5,
        late_fee_after_days: 7, max_late_fee: 500,
        upi_id: '', phonepe_merchant_id: '', allow_partial_payments: false, min_payment_amount: 500,
        reminder_email: true, reminder_in_app: true, reminder_whatsapp: false,
        reminder_day_1: true, reminder_day_5: true, reminder_day_10: true,
        late_fee_notification: true, owner_daily_summary: false,
        auto_generate_rent: true, auto_apply_late_fees: true, auto_send_reminders: true, auto_deactivate_days: 0,
        receipt_prefix: 'HMS', receipt_format: 'PREFIX-YEAR-SEQ', auto_email_receipt: false, receipt_footer: '',
        require_doc_approval: false, require_aadhaar: false, allow_tenant_edits: true, data_retention_months: 0,
        timezone: 'Asia/Kolkata', date_format: 'DD/MM/YYYY', language: 'en',
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
                const data = await ownerService.getProfile();
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
            showTempSuccess('Hostel details updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update hostel details'));
        } finally { setSaving(false); }
    };

    // FIX #2: Global save — sends all preferences in one PATCH
    const saveAllPreferences = async () => {
        setSaving(true); setError('');
        try {
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
                auto_generate_rent: preferences.auto_generate_rent, auto_apply_late_fees: preferences.auto_apply_late_fees,
                auto_send_reminders: preferences.auto_send_reminders, auto_deactivate_days: preferences.auto_deactivate_days,
                auto_email_receipt: preferences.auto_email_receipt, receipt_format: preferences.receipt_format,
                receipt_footer: preferences.receipt_footer, require_doc_approval: preferences.require_doc_approval,
                allow_tenant_edits: preferences.allow_tenant_edits, data_retention_months: preferences.data_retention_months,
                date_format: preferences.date_format, language: preferences.language,
                reminder_email: preferences.reminder_email, reminder_in_app: preferences.reminder_in_app,
                reminder_whatsapp: preferences.reminder_whatsapp, reminder_day_1: preferences.reminder_day_1,
                reminder_day_5: preferences.reminder_day_5, reminder_day_10: preferences.reminder_day_10,
                late_fee_notification: preferences.late_fee_notification, owner_daily_summary: preferences.owner_daily_summary,
                allow_partial_payments: preferences.allow_partial_payments, min_payment_amount: preferences.min_payment_amount,
            };
            await ownerService.updatePreferences(preferencePayload);
            setSavedPreferences({ ...preferences });
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
                    <Field label="Full Name" value={ownerForm.name} onChange={(v) => setOwnerForm({ ...ownerForm, name: v })} required />
                    <Field label="Email (read-only)" value={ownerForm.email} onChange={() => { }} disabled />
                    <Field label="Phone" value={ownerForm.phone} onChange={(v) => setOwnerForm({ ...ownerForm, phone: v })} />
                    <SaveButton saving={saving} />
                </form>
            )}

            {/* ─── Hostel Details Tab ─── */}
            {activeTab === 'hostel' && (
                <form onSubmit={saveHostel} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <ProfileLogoUploader logoUrl={hostelForm.logo_url} onUpload={uploadLogo} onRemove={removeLogo} disabled={saving} />
                    <Field label="Hostel Name" value={hostelForm.name} onChange={(v) => setHostelForm({ ...hostelForm, name: v })} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Hostel Phone" value={hostelForm.phone} onChange={(v) => setHostelForm({ ...hostelForm, phone: v })} required />
                        <Field label="Pincode" value={hostelForm.pincode} onChange={(v) => setHostelForm({ ...hostelForm, pincode: v })} required />
                    </div>
                    <Field label="Address" value={hostelForm.address} onChange={(v) => setHostelForm({ ...hostelForm, address: v })} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="City" value={hostelForm.city} onChange={(v) => setHostelForm({ ...hostelForm, city: v })} required />
                        <Field label="State" value={hostelForm.state} onChange={(v) => setHostelForm({ ...hostelForm, state: v })} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="UPI ID" value={hostelForm.upi_id} onChange={(v) => setHostelForm({ ...hostelForm, upi_id: v })} />
                        <Field label="GST Number" value={hostelForm.gst_number} onChange={(v) => setHostelForm({ ...hostelForm, gst_number: v })} />
                    </div>
                    <SaveButton saving={saving} />
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
                                        {mod.key === 'notifications' && <NotificationsModule prefs={preferences} updatePref={updatePref} />}
                                        {mod.key === 'automation' && <AutomationModule prefs={preferences} updatePref={updatePref} />}
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
    );
}

// ──── MODULE PANELS ────────────────────────────────────────────

function BillingModule({ prefs, updatePref }) {
    // ELITE #1: Enhanced simulation preview with day-by-day timeline
    const simulation = useMemo(() => {
        if (prefs.late_fee_type === 'none') return null;
        const rent = 8000;
        const afterDays = prefs.late_fee_after_days || 7;
        const feePerHit = prefs.late_fee_type === 'flat'
            ? Number(prefs.late_fee_amount)
            : Math.round(rent * Number(prefs.late_fee_percentage) / 100);
        const cap = Number(prefs.max_late_fee) || Infinity;
        const dueDay = prefs.due_day || 5;

        const timeline = [];
        timeline.push({ label: `May 1`, desc: 'Rent generated', amount: rent, color: 'slate' });
        timeline.push({ label: `May ${dueDay}`, desc: 'Due date', amount: rent, color: 'indigo' });
        const feeDay = dueDay + afterDays;
        const totalWithFee = rent + Math.min(feePerHit, cap);
        timeline.push({ label: `May ${feeDay}`, desc: `Late fee applied (+₹${Math.min(feePerHit, cap)})`, amount: totalWithFee, color: 'amber' });
        if (cap < feePerHit * 3) {
            timeline.push({ label: `Cap`, desc: `Max fee ₹${cap}`, amount: rent + cap, color: 'rose' });
        }
        return timeline;
    }, [prefs.late_fee_type, prefs.late_fee_amount, prefs.late_fee_percentage, prefs.late_fee_after_days, prefs.max_late_fee, prefs.due_day]);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <SelectField label="Rent Cycle" value={prefs.rent_cycle}
                    options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' }, { value: 'YEARLY', label: 'Yearly' }]}
                    onChange={(v) => updatePref('rent_cycle', v)} />
                <SelectField label="Generation Day" value={String(prefs.auto_rent_day)}
                    options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}${getDaySuffix(i + 1)}` }))}
                    onChange={(v) => updatePref('auto_rent_day', Number(v))} />
            </div>
            <SelectField label="Due Day" value={String(prefs.due_day)}
                options={[{ value: '5', label: '5th of month' }, { value: '10', label: '10th of month' }, { value: '15', label: '15th of month' }, { value: '20', label: '20th of month' }]}
                onChange={(v) => updatePref('due_day', Number(v))} />

            <Divider label="Late Fee Rules" />

            <SelectField label="Late Fee Type" value={prefs.late_fee_type}
                options={[{ value: 'none', label: 'None' }, { value: 'flat', label: 'Flat Amount' }, { value: 'percentage', label: 'Percentage of Rent' }]}
                onChange={(v) => updatePref('late_fee_type', v)} />

            {prefs.late_fee_type === 'flat' && (
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Flat Amount (₹)" value={prefs.late_fee_amount} type="number"
                        onChange={(v) => updatePref('late_fee_amount', Number(v))} />
                    <Field label="Apply After (days)" value={prefs.late_fee_after_days} type="number"
                        onChange={(v) => updatePref('late_fee_after_days', Number(v))} />
                </div>
            )}
            {prefs.late_fee_type === 'percentage' && (
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Percentage (%)" value={prefs.late_fee_percentage} type="number"
                        onChange={(v) => updatePref('late_fee_percentage', Number(v))} />
                    <Field label="Apply After (days)" value={prefs.late_fee_after_days} type="number"
                        onChange={(v) => updatePref('late_fee_after_days', Number(v))} />
                </div>
            )}
            {prefs.late_fee_type !== 'none' && (
                <Field label="Maximum Late Fee (₹)" value={prefs.max_late_fee} type="number"
                    onChange={(v) => updatePref('max_late_fee', Number(v))} />
            )}

            {/* ELITE #1: Day-by-day simulation timeline */}
            {simulation && (
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-4 py-3.5">
                    <p className="text-indigo-700 font-semibold text-sm mb-3 flex items-center gap-1.5">
                        <Calendar size={14} /> Billing Simulation (₹8,000 rent)
                    </p>
                    <div className="space-y-0">
                        {simulation.map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="flex flex-col items-center">
                                    <div className={`w-2.5 h-2.5 rounded-full mt-1 ${step.color === 'slate' ? 'bg-slate-400' : step.color === 'indigo' ? 'bg-indigo-500' : step.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                    {i < simulation.length - 1 && <div className="w-px h-6 bg-slate-200" />}
                                </div>
                                <div className="pb-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-slate-600">{step.label}</span>
                                        <span className="text-xs text-slate-400">{step.desc}</span>
                                    </div>
                                    <span className={`text-sm font-bold ${step.color === 'amber' || step.color === 'rose' ? 'text-amber-700' : 'text-slate-700'}`}>
                                        ₹{step.amount.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
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
                <Field label="Minimum Payment (₹)" value={prefs.min_payment_amount} type="number"
                    onChange={(v) => updatePref('min_payment_amount', Number(v))} />
            )}
        </div>
    );
}

function NotificationsModule({ prefs, updatePref }) {
    const [testSending, setTestSending] = useState(false);
    const [testSent, setTestSent] = useState(false);

    // ELITE #2: Test reminder button — wired to real backend
    const [testResult, setTestResult] = useState('');
    const sendTestReminder = async () => {
        setTestSending(true);
        setTestResult('');
        try {
            const res = await ownerService.sendTestReminder('DUE_SOON');
            setTestSent(true);
            setTestResult(res?.message || 'Test reminder sent!');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setTestResult(typeof detail === 'string' ? detail : (detail?.message || 'Failed to send test reminder'));
        } finally {
            setTestSending(false);
            setTimeout(() => { setTestSent(false); setTestResult(''); }, 5000);
        }
    };

    return (
        <div className="space-y-3">
            <Divider label="Channels" />
            <ToggleField label="Email" desc="Send reminders via email" value={prefs.reminder_email}
                onChange={(v) => updatePref('reminder_email', v)} />
            <ToggleField label="In-App" desc="Show in tenant dashboard" value={prefs.reminder_in_app}
                onChange={(v) => updatePref('reminder_in_app', v)} />
            {/* ELITE #3: Feature locking — WhatsApp greyed out with roadmap badge */}
            <div className="relative">
                <ToggleField label="WhatsApp" desc="Send via WhatsApp" value={false} onChange={() => { }} disabled />
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

            {/* ELITE #2: Test Reminder Button */}
            <div className="pt-1 space-y-2">
                <button type="button" onClick={sendTestReminder} disabled={testSending || testSent}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${testSent
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:bg-slate-200'
                        } disabled:opacity-60`}>
                    {testSending ? <Loader2 size={14} className="animate-spin" />
                        : testSent ? <CheckCircle2 size={14} />
                            : <Send size={14} />}
                    {testSending ? 'Sending...' : testSent ? (testResult || 'Sent!') : 'Send Test Reminder to Myself'}
                </button>
                {testResult && !testSent && (
                    <p className="text-xs text-rose-600 text-center">{testResult}</p>
                )}
            </div>
        </div>
    );
}

function AutomationModule({ prefs, updatePref }) {
    return (
        <div className="space-y-3">
            <ToggleField label="Auto Generate Rent" desc="Monthly rent obligations created automatically"
                value={prefs.auto_generate_rent} onChange={(v) => updatePref('auto_generate_rent', v)} />
            <ToggleField label="Auto Apply Late Fees" desc="Late fees added after overdue period"
                value={prefs.auto_apply_late_fees} onChange={(v) => updatePref('auto_apply_late_fees', v)} />
            <ToggleField label="Auto Send Reminders" desc="Overdue reminders sent on schedule"
                value={prefs.auto_send_reminders} onChange={(v) => updatePref('auto_send_reminders', v)} />
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
            <SelectField label="Language" value={prefs.language}
                options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }]}
                onChange={(v) => updatePref('language', v)} />
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

function Divider({ label }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <div className="flex-1 h-px bg-slate-100" />
        </div>
    );
}
