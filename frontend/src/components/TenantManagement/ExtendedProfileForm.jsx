import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, User, Phone, Mail, MapPin, GraduationCap,
    Camera, Upload, Loader2, CheckCircle2, AlertCircle,
    Lock, FileText, ChevronRight, Info
} from 'lucide-react';
import { tenantService } from '../../api/services';

export default function ExtendedProfileForm({ isOpen, onClose, tenant, onSave }) {
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');
    const [photoPreview, setPhotoPreview] = useState(null);
    const [fullTenant, setFullTenant] = useState(null);

    const [form, setForm] = useState({
        // Section 1: Personal
        name: '',
        personal_email: '',
        phone_1: '',
        phone_2: '',
        aadhaar_number: '',
        photo_url: '',
        
        // Subsection: Address
        address: '',
        city: '',
        state: '',
        pincode: '',
        
        // Section 2: Education
        college_name: '',
        course: '',
        year_of_study: '',
        roll_number: '',
        branch: '',
        section: ''
    });

    const initializeFromTenant = useCallback((data) => {
        if (!data) return;
        setFullTenant(data);
        setForm({
            name: data.profile?.name || data.name || '',
            personal_email: data.personal_email || data.profile?.email || '',
            phone_1: data.phone_1 || data.profile?.phone || '',
            phone_2: data.phone_2 || '',
            aadhaar_number: data.aadhaar_number || '',
            photo_url: data.photo_url || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            college_name: data.college_name || '',
            course: data.course || '',
            year_of_study: data.year_of_study || '',
            roll_number: data.roll_number || '',
            branch: data.branch || '',
            section: data.section || ''
        });
        setPhotoPreview(data.photo_url || null);
    }, []);

    useEffect(() => {
        if (!isOpen || !tenant?.id) return;
        
        setError('');
        setSuccessMsg('');
        initializeFromTenant(tenant);

        const fetchFullProfile = async () => {
            setLoadingDetails(true);
            try {
                const full = await tenantService.getById(tenant.id);
                initializeFromTenant(full);
            } catch (err) {
                console.error('Failed to load full tenant profile:', err);
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchFullProfile();
    }, [isOpen, tenant, initializeFromTenant]);

    const progress = useMemo(() => {
        const fields = Object.values(form);
        const filled = fields.filter(f => f && String(f).trim().length > 0).length;
        return Math.round((filled / fields.length) * 100);
    }, [form]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Photo must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
                setForm(prev => ({ ...prev, photo_url: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const formatAadhaar = (val) => {
        const clean = val.replace(/\s/g, '').substring(0, 12);
        if (clean.length <= 8) return clean.replace(/./g, 'X');
        const visible = clean.substring(8);
        return 'XXXX XXXX ' + visible;
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        try {
            const payload = { ...form };
            if (photoPreview && photoPreview.startsWith('data:')) {
                payload.photo_url = photoPreview;
            }
            await tenantService.update(tenant.id, payload);
            setSuccessMsg('Profile updated successfully!');
            setTimeout(() => {
                setSuccessMsg('');
                if (onSave) onSave();
            }, 1500);
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'object' ? detail.message : detail || err.message);
        } finally {
            setSaving(false);
        }
    };

    const [activeTab, setActiveTab] = useState('personal');

    const tabs = [
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'education', label: 'Education Info', icon: GraduationCap }
    ];

    if (!isOpen) return null;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'personal':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                        {/* 1. Identity Records */}
                        <div className="space-y-4 sm:space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                <User size={12} /> Identity Records
                            </h3>
                            <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
                                <div className="flex flex-col items-center gap-2 shrink-0">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] sm:rounded-[2rem] bg-indigo-50/30 border-4 border-white shadow-xl overflow-hidden relative">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-200">
                                                <User size={32} className="sm:size-[48px]" strokeWidth={1.5} />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 sm:mt-2">Portrait</p>
                                </div>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <SaaSInput label="Full Name" value={form.name} readOnly placeholder="Not Set" />
                                    <SaaSInput label="Personal Email" value={form.personal_email} readOnly icon={Lock} placeholder="Not Set" />
                                    <SaaSInput label="Phone Number" value={form.phone_1} readOnly placeholder="Not Set" />
                                    <SaaSInput label="Aadhaar Number" value={form.aadhaar_number} readOnly placeholder="XXXX XXXX XXXX" />
                                    <div className="sm:col-span-2">
                                        <SaaSInput label="Emergency Contact" value={form.phone_2} readOnly placeholder="Primary Guardian / Relative Contact" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Address Records */}
                        <div className="space-y-4 sm:space-y-6 pt-8 sm:pt-12 border-t border-slate-50">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                <MapPin size={12} /> Resident Status
                            </h3>
                            <div className="space-y-4 sm:space-y-6 p-5 sm:p-8 bg-slate-50/50 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100">
                                <SaaSInput label="Permanent/Full Address" value={form.address} readOnly placeholder="Not Set" />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                                    <SaaSInput label="City" value={form.city} readOnly placeholder="Not Set" />
                                    <SaaSInput label="State" value={form.state} readOnly placeholder="Not Set" />
                                    <SaaSInput label="Pincode" value={form.pincode} readOnly placeholder="Not Set" />
                                </div>
                            </div>
                        </div>

                        {/* 3. Document Records */}
                        <div className="space-y-6 pt-12 border-t border-slate-50">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                <FileText size={12} /> Document Records
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start">
                                <DocumentDropBox label="Aadhaar Card" />
                                <div className="bg-amber-50/50 border border-amber-100/50 p-6 rounded-3xl flex gap-4 items-center">
                                    <Lock size={20} className="text-amber-500 shrink-0" />
                                    <div>
                                        <h4 className="text-[9px] font-black text-amber-900 uppercase tracking-widest mb-1">Encrypted</h4>
                                        <p className="text-[10px] text-amber-800/80 font-bold leading-relaxed">
                                            Aadhaar documents are encrypted and stored securely.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex gap-4 mt-2">
                            <Info size={20} className="text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-500 font-bold leading-relaxed">
                                These identity markers are verified at the time of allocation. Any changes must be submitted through the tenant dashboard and approved by the administrator.
                            </p>
                        </div>
                    </motion.div>
                );
            case 'education':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 sm:space-y-10">
                        <div className="bg-indigo-600 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl shadow-indigo-600/30 overflow-hidden relative group">
                            <GraduationCap className="absolute -right-8 sm:-right-10 -bottom-8 sm:-bottom-10 text-white/5 group-hover:scale-110 transition-transform" size={120} strokeWidth={1} />
                            <div className="relative z-10">
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-white/70 mb-2 sm:mb-4">Academic Status</p>
                                <h3 className="text-xl sm:text-4xl font-black tracking-tight">{form.college_name || 'Verification Pending'}</h3>
                                <p className="text-sm sm:text-lg font-bold text-white/90 mt-1 sm:mt-2">{form.course || 'Educational Institution not verified'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-8">
                            <div className="bg-white p-4 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] border-2 border-slate-50 shadow-sm space-y-2 sm:space-y-4">
                                <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Branch</label>
                                <div className="text-base sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                                    {form.branch || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-white p-4 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] border-2 border-slate-50 shadow-sm space-y-2 sm:space-y-4">
                                <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Year</label>
                                <div className="text-base sm:text-2xl font-black text-slate-900">
                                    {form.year_of_study ? `${form.year_of_study} Year` : 'Data Missing'}
                                </div>
                            </div>
                            <div className="bg-white p-4 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] border-2 border-slate-50 shadow-sm space-y-2 sm:space-y-4">
                                <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Roll No</label>
                                <div className="text-base sm:text-2xl font-black text-slate-900 uppercase">
                                    {form.roll_number || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-white p-4 sm:p-8 rounded-[1.25rem] sm:rounded-[2rem] border-2 border-slate-50 shadow-sm space-y-2 sm:space-y-4">
                                <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Section</label>
                                <div className="text-base sm:text-2xl font-black text-slate-900 uppercase">
                                    {form.section || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl w-full sm:max-w-5xl h-[95vh] sm:h-[85vh] overflow-hidden relative z-10 flex flex-col border border-slate-100"
            >
                {/* Fixed Header */}
                <div className="px-6 sm:px-12 py-6 sm:py-10 border-b border-slate-50 flex flex-col gap-6 sm:gap-10 bg-white shrink-0">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-900 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-slate-900/20">
                                <User size={20} className="sm:size-[28px]" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">{form.name || 'Tenant Profile'}</h2>
                                <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 flex-wrap">
                                    <span className="text-[8px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                                        ID: {tenant?.rollNumber || tenant?.id?.substring(0, 8) || 'HMS-00'}
                                    </span>
                                    <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 px-1.5 py-0.5 rounded-md">
                                        Tenant Record
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all border border-slate-100 group shrink-0">
                            <X size={20} className="sm:size-[24px] group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-50 overflow-x-auto no-scrollbar -mx-6 sm:mx-0 px-6 sm:px-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-5 rounded-t-2xl sm:rounded-t-3xl transition-all relative shrink-0 ${
                                    activeTab === tab.id 
                                    ? 'bg-indigo-50/60 text-indigo-700' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon size={16} className="sm:size-[20px]" strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                <span className={`text-xs sm:text-[15px] font-black tracking-tight ${activeTab === tab.id ? 'opacity-100' : 'opacity-80'}`}>
                                    {tab.label}
                                </span>
                                {activeTab === tab.id && (
                                    <motion.div 
                                        layoutId="tabBarIndicator"
                                        className="absolute bottom-0 left-4 sm:left-6 right-4 sm:right-6 h-0.5 sm:h-1 bg-indigo-600 rounded-full"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 sm:py-12 bg-white/50 no-scrollbar">
                    <AnimatePresence mode="wait">
                        {renderTabContent()}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-12 py-6 sm:py-8 border-t border-slate-50 bg-white flex justify-between items-center shrink-0">
                    <div className="hidden sm:flex items-center gap-4 text-slate-400 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                        <Lock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Record Integrity: Strict Protocol</span>
                    </div>
                    <button onClick={onClose} className="w-full sm:w-auto px-10 sm:px-12 py-3.5 sm:py-4 rounded-xl sm:rounded-[1.5rem] bg-indigo-600 text-white text-xs sm:text-sm font-black hover:bg-slate-900 transition-all shadow-xl shadow-indigo-600/10 active:scale-95 uppercase tracking-widest outline-none">
                        Close Profile
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// Internal Styled Input Component
function SaaSInput({ label, value, readOnly = true, placeholder, icon: Icon }) {
    const [isMasked, setIsMasked] = useState(label === 'Aadhaar Number');
    
    const displayValue = useMemo(() => {
        if (!value) return '';
        if (label === 'Aadhaar Number' && isMasked) {
             const clean = value.replace(/\s/g, '');
             const masked = clean.substring(0, 8).replace(/./g, 'X') + clean.substring(8);
             return masked.replace(/(\w{4})/g, '$1 ').trim();
        }
        if (label === 'Aadhaar Number') {
            return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
        }
        return value || '';
    }, [value, label, isMasked]);

    return (
        <div className="space-y-2 sm:space-y-3 group">
            <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {label}
            </label>
            <div className="relative">
                <div className={`w-full px-4 sm:px-6 py-3.5 sm:py-4.5 bg-white border-2 border-slate-50 rounded-xl sm:rounded-2xl text-[12px] sm:text-[14px] font-black text-slate-700 flex items-center transition-all shadow-sm ${!value ? 'text-slate-200 italic' : ''}`}>
                    {displayValue || placeholder}
                    {label === 'Aadhaar Number' && (
                        <button 
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setIsMasked(!isMasked); }}
                            className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                            {isMasked ? <Info size={14} className="sm:size-[16px]" /> : <CheckCircle2 size={14} className="sm:size-[16px]" />}
                        </button>
                    )}
                    {Icon && label !== 'Aadhaar Number' && (
                        <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-300">
                            <Icon size={16} className="sm:size-[18px]" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Internal Styled Document Box
function DocumentDropBox({ label }) {
    return (
        <div className="border border-slate-100 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-3 sm:gap-4 min-h-[120px] sm:min-h-[160px] group hover:bg-indigo-50/30 transition-all">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-colors">
                <FileText size={20} className="sm:size-[24px]" />
            </div>
            <div>
                <p className="text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-tight">{label}</p>
                <p className="text-[8px] sm:text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1 sm:mt-1.5 opacity-80">Stored Securely</p>
            </div>
        </div>
    );
}
