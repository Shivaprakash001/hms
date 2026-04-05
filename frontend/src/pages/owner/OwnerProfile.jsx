import React, { useEffect, useState } from 'react';
import { User, Building2, Settings, Save, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ownerService } from '../../api/services';

const tabs = [
    { key: 'owner', label: 'Owner Profile', icon: User },
    { key: 'hostel', label: 'Hostel Details', icon: Building2 },
    { key: 'preferences', label: 'Preferences', icon: Settings },
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
        name: '', phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: ''
    });
    const [preferences, setPreferences] = useState({ currency: 'INR', rent_cycle: 'MONTHLY', receipt_prefix: 'HMS', timezone: 'Asia/Kolkata' });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await ownerService.getProfile();
                const owner = data?.owner || {};
                const hostel = data?.hostel || {};
                const prefs = data?.preferences || {};
                setOwnerForm({
                    name: owner.name || '',
                    email: owner.email || '',
                    phone: owner.phone || ''
                });
                setHostelForm({
                    name: hostel.name || '',
                    phone: hostel.phone || '',
                    address: hostel.address || '',
                    city: hostel.city || '',
                    state: hostel.state || '',
                    pincode: hostel.pincode || '',
                    upi_id: hostel.upi_id || '',
                    gst_number: hostel.gst_number || ''
                });
                setPreferences({
                    currency: prefs.currency || 'INR',
                    rent_cycle: prefs.rent_cycle || 'MONTHLY',
                    receipt_prefix: prefs.receipt_prefix || 'HMS',
                    timezone: prefs.timezone || 'Asia/Kolkata'
                });
            } catch (e) {
                const detail = e?.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to load profile data'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            p.set('tab', activeTab);
            return p;
        });
    }, [activeTab, setSearchParams]);

    const showTempSuccess = (msg) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(''), 2200);
    };

    const saveOwner = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const data = await ownerService.updateOwner({ name: ownerForm.name, phone: ownerForm.phone });
            const owner = data?.owner || {};
            setOwnerForm(prev => ({ ...prev, name: owner.name || prev.name, phone: owner.phone || prev.phone, email: owner.email || prev.email }));
            showTempSuccess('Owner profile updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update owner profile'));
        } finally {
            setSaving(false);
        }
    };

    const saveHostel = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const data = await ownerService.updateHostel(hostelForm);
            const hostel = data?.hostel || {};
            setHostelForm({
                name: hostel.name || '',
                phone: hostel.phone || '',
                address: hostel.address || '',
                city: hostel.city || '',
                state: hostel.state || '',
                pincode: hostel.pincode || '',
                upi_id: hostel.upi_id || '',
                gst_number: hostel.gst_number || ''
            });
            showTempSuccess('Hostel details updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update hostel details'));
        } finally {
            setSaving(false);
        }
    };

    const savePreferences = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const data = await ownerService.updatePreferences(preferences);
            const prefs = data?.preferences || {};
            setPreferences({
                currency: prefs.currency || preferences.currency,
                rent_cycle: prefs.rent_cycle || preferences.rent_cycle,
                receipt_prefix: prefs.receipt_prefix || preferences.receipt_prefix,
                timezone: prefs.timezone || preferences.timezone,
            });
            showTempSuccess('Preferences updated');
        } catch (e) {
            const detail = e?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to update preferences'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-slate-500">Loading profile settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Profile Settings</h2>
                <p className="text-sm text-slate-500 mt-1">Manage owner details, hostel information, and preferences.</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm flex flex-wrap gap-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Icon size={16} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">{error}</div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">{success}</div>}

            {activeTab === 'owner' && (
                <form onSubmit={saveOwner} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 max-w-3xl">
                    <Field label="Full Name" value={ownerForm.name} onChange={(v) => setOwnerForm({ ...ownerForm, name: v })} required />
                    <Field label="Email (read-only)" value={ownerForm.email} onChange={() => { }} disabled />
                    <Field label="Phone" value={ownerForm.phone} onChange={(v) => setOwnerForm({ ...ownerForm, phone: v })} />
                    <SaveButton saving={saving} />
                </form>
            )}

            {activeTab === 'hostel' && (
                <form onSubmit={saveHostel} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 max-w-4xl">
                    <Field label="Hostel Name" value={hostelForm.name} onChange={(v) => setHostelForm({ ...hostelForm, name: v })} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Hostel Phone" value={hostelForm.phone} onChange={(v) => setHostelForm({ ...hostelForm, phone: v })} required />
                        <Field label="Pincode" value={hostelForm.pincode} onChange={(v) => setHostelForm({ ...hostelForm, pincode: v })} required />
                    </div>
                    <Field label="Address" value={hostelForm.address} onChange={(v) => setHostelForm({ ...hostelForm, address: v })} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="City" value={hostelForm.city} onChange={(v) => setHostelForm({ ...hostelForm, city: v })} required />
                        <Field label="State" value={hostelForm.state} onChange={(v) => setHostelForm({ ...hostelForm, state: v })} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="UPI ID (optional)" value={hostelForm.upi_id} onChange={(v) => setHostelForm({ ...hostelForm, upi_id: v })} />
                        <Field label="GST Number (optional)" value={hostelForm.gst_number} onChange={(v) => setHostelForm({ ...hostelForm, gst_number: v })} />
                    </div>
                    <SaveButton saving={saving} />
                </form>
            )}

            {activeTab === 'preferences' && (
                <form onSubmit={savePreferences} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm max-w-3xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <SelectField
                            label="Currency"
                            value={preferences.currency}
                            options={[
                                { value: 'INR', label: 'INR' },
                                { value: 'USD', label: 'USD' },
                                { value: 'EUR', label: 'EUR' },
                                { value: 'GBP', label: 'GBP' },
                            ]}
                            onChange={(v) => setPreferences(prev => ({ ...prev, currency: v }))}
                        />
                        <SelectField
                            label="Rent Cycle"
                            value={preferences.rent_cycle}
                            options={[
                                { value: 'MONTHLY', label: 'MONTHLY' },
                                { value: 'QUARTERLY', label: 'QUARTERLY' },
                                { value: 'YEARLY', label: 'YEARLY' },
                            ]}
                            onChange={(v) => setPreferences(prev => ({ ...prev, rent_cycle: v }))}
                        />
                        <Field
                            label="Receipt Prefix"
                            value={preferences.receipt_prefix}
                            onChange={(v) => setPreferences(prev => ({ ...prev, receipt_prefix: v.toUpperCase().replace(/\s+/g, '') }))}
                            required
                        />
                        <SelectField
                            label="Timezone"
                            value={preferences.timezone}
                            options={[
                                { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
                                { value: 'Asia/Dubai', label: 'Asia/Dubai' },
                                { value: 'UTC', label: 'UTC' },
                                { value: 'America/New_York', label: 'America/New_York' },
                            ]}
                            onChange={(v) => setPreferences(prev => ({ ...prev, timezone: v }))}
                        />
                    </div>
                    <SaveButton saving={saving} />
                </form>
            )}
        </div>
    );
}

function Field({ label, value, onChange, required = false, disabled = false }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                disabled={disabled}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${disabled ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`}
            />
        </div>
    );
}

function SaveButton({ saving }) {
    return (
        <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-70"
        >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
        </button>
    );
}

function SelectField({ label, value, onChange, options }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
