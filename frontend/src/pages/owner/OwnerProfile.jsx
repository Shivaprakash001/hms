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
        hostel_name: '', hostel_phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: ''
    });
    const [preferences] = useState({ currency: 'INR', rent_cycle: 'MONTHLY', receipt_prefix: 'HMS', timezone: 'Asia/Kolkata' });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await ownerService.getProfile();
                const owner = data?.owner || {};
                const hostel = data?.hostel || {};
                setOwnerForm({
                    name: owner.name || '',
                    email: owner.email || '',
                    phone: owner.phone || ''
                });
                setHostelForm({
                    hostel_name: hostel.name || '',
                    hostel_phone: hostel.phone || '',
                    address: hostel.address || '',
                    city: hostel.city || '',
                    state: hostel.state || '',
                    pincode: hostel.pincode || '',
                    upi_id: hostel.upi_id || '',
                    gst_number: hostel.gst_number || ''
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
                hostel_name: hostel.name || '',
                hostel_phone: hostel.phone || '',
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
                    <Field label="Hostel Name" value={hostelForm.hostel_name} onChange={(v) => setHostelForm({ ...hostelForm, hostel_name: v })} required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Hostel Phone" value={hostelForm.hostel_phone} onChange={(v) => setHostelForm({ ...hostelForm, hostel_phone: v })} required />
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
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm max-w-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <Preference label="Currency" value={preferences.currency} />
                        <Preference label="Rent Cycle" value={preferences.rent_cycle} />
                        <Preference label="Receipt Prefix" value={preferences.receipt_prefix} />
                        <Preference label="Timezone" value={preferences.timezone} />
                    </div>
                    <p className="text-xs text-slate-400 mt-4">Preferences are currently read-only and can be enabled in the next step.</p>
                </div>
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

function Preference({ label, value }) {
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
            <p className="text-slate-800 font-semibold mt-1">{value}</p>
        </div>
    );
}
