import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, User, Phone, Mail, MapPin, GraduationCap,
    Camera, Upload, Loader2, CheckCircle2, AlertCircle,
    Lock, FileText, ChevronRight, Info
} from 'lucide-react';
import { studentService } from '../../api/services';

export default function ExtendedProfileForm({ isOpen, onClose, student, onSave }) {
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');
    const [photoPreview, setPhotoPreview] = useState(null);
    const [fullStudent, setFullStudent] = useState(null);

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
        branch: ''
    });

    const initializeFromStudent = useCallback((data) => {
        if (!data) return;
        setFullStudent(data);
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
            branch: data.branch || ''
        });
        setPhotoPreview(data.photo_url || null);
    }, []);

    useEffect(() => {
        if (!isOpen || !student?.id) return;
        
        setError('');
        setSuccessMsg('');
        initializeFromStudent(student);

        const fetchFullProfile = async () => {
            setLoadingDetails(true);
            try {
                const full = await studentService.getById(student.id);
                initializeFromStudent(full);
            } catch (err) {
                console.error('Failed to load full tenant profile:', err);
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchFullProfile();
    }, [isOpen, student, initializeFromStudent]);

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
            await studentService.update(student.id, payload);
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
        { id: 'contact', label: 'Contact', icon: Phone },
        { id: 'education', label: 'Education', icon: GraduationCap },
        { id: 'address', label: 'Address', icon: MapPin },
        { id: 'documents', label: 'Documents', icon: FileText }
    ];

    if (!isOpen) return null;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'personal':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                         <div className="flex flex-col sm:flex-row gap-8">
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <div className="w-28 h-28 rounded-3xl bg-slate-50 border-2 border-white shadow-lg overflow-hidden relative">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                                            <User size={40} strokeWidth={1.5} />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identity Photo</p>
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SaaSInput label="Full Name" value={form.name} readOnly placeholder="Not Entered" />
                                <SaaSInput label="Personal Email" value={form.personal_email} readOnly icon={Lock} placeholder="Not Entered" />
                                <SaaSInput label="Aadhaar Number" value={form.aadhaar_number} readOnly placeholder="XXXX XXXX XXXX" />
                                <div className="flex items-end pb-1">
                                    <div className="bg-indigo-50/50 border border-indigo-100/50 px-4 py-3 rounded-xl flex items-center gap-3 w-full">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Awaiting Verification</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'contact':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-xl">
                        <SaaSInput label="Primary Phone" value={form.phone_1} readOnly placeholder="Not Entered" />
                        <SaaSInput label="Secondary / Emergency" value={form.phone_2} readOnly placeholder="Not Entered" />
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4 mt-2">
                            <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                These contact details are managed exclusively by the tenant for emergency protocols and automated billing notifications.
                            </p>
                        </div>
                    </motion.div>
                );
            case 'education':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SaaSInput label="College Name" value={form.college_name} readOnly placeholder="Not Entered" />
                        <SaaSInput label="Course / Major" value={form.course} readOnly placeholder="Not Entered" />
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Year</label>
                            <div className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 opacity-60">
                                {form.year_of_study ? `${form.year_of_study} Year` : 'Not Entered'}
                            </div>
                        </div>
                        <SaaSInput label="Student ID / Roll No" value={form.roll_number} readOnly placeholder="Not Entered" />
                    </motion.div>
                );
            case 'address':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <SaaSInput label="Full Address" value={form.address} readOnly placeholder="Not Entered" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <SaaSInput label="City" value={form.city} readOnly placeholder="Not Entered" />
                            <SaaSInput label="State" value={form.state} readOnly placeholder="Not Entered" />
                            <SaaSInput label="Pincode" value={form.pincode} readOnly placeholder="Not Entered" />
                        </div>
                    </motion.div>
                );
            case 'documents':
                return (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <DocumentDropBox label="Aadhaar" />
                        <DocumentDropBox label="College ID" />
                        <DocumentDropBox label="Other" />
                    </motion.div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 20 }}
                className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[85vh] overflow-hidden relative z-10 flex flex-col border border-slate-100"
            >
                {/* Image-Consistent Navigation Header */}
                <div className="px-6 sm:px-10 py-6 border-b border-slate-50 flex flex-col gap-6 bg-white shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                <User size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">{form.name || 'Tenant Profile'}</h2>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{form.personal_email || 'Verified Tenant'}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all border border-slate-100">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tab Navigation - Matches User Image */}
                    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all relative ${
                                    activeTab === tab.id 
                                    ? 'bg-indigo-50 text-indigo-600' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                <span className={`text-[13px] font-bold tracking-tight whitespace-nowrap ${activeTab === tab.id ? 'opacity-100' : 'opacity-80'}`}>
                                    {tab.label}
                                </span>
                                {activeTab === tab.id && (
                                    <motion.div 
                                        layoutId="tabUnderline"
                                        className="absolute -bottom-1 left-4 right-4 h-0.5 bg-indigo-500 rounded-full hidden sm:block"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 bg-white/50">
                    <AnimatePresence mode="wait">
                        {renderTabContent()}
                    </AnimatePresence>
                </div>

                {/* Footer - Read Only View */}
                <div className="px-10 py-6 border-t border-slate-50 bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        <Lock size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Managed by Tenant</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                    >
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
        <div className="space-y-1.5 group">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1">
                {label}
            </label>
            <div className="relative">
                <div className={`w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center transition-all ${!value ? 'text-slate-300 italic' : ''}`}>
                    {displayValue || placeholder}
                    {label === 'Aadhaar Number' && (
                        <button 
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setIsMasked(!isMasked); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
                        >
                            {isMasked ? <Info size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                    )}
                    {Icon && label !== 'Aadhaar Number' && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                            <Icon size={14} />
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
        <div className="border border-slate-100 rounded-2xl p-6 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                <FileText size={18} />
            </div>
            <div>
                <p className="text-[11px] font-black text-slate-700">{label}</p>
                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter mt-1">Ready for Review</p>
            </div>
        </div>
    );
}
