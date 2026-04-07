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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 20 }}
                className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden relative z-10 flex flex-col border border-slate-100"
            >
                {/* Modern Header */}
                <div className="px-6 sm:px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <User size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Extended Profile</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        className="h-full bg-indigo-500 rounded-full"
                                    />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{progress}% Complete</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Two-Pane Body - Responsive */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left Pane: Main Scrolling Content (Personal, Address, Docs) */}
                    <div className="flex-[1.6] overflow-y-auto p-6 sm:p-10 space-y-10 lg:border-r border-slate-50 scroll-smooth">
                        {/* Section 1: Personal Information */}
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
                                <User size={12} /> Personal Profile
                            </h3>

                            <div className="flex flex-col sm:flex-row gap-8">
                                {/* Profile Photo - READ ONLY */}
                                <div className="flex flex-col items-center gap-2 shrink-0">
                                    <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-white shadow-lg overflow-hidden relative">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Camera size={32} strokeWidth={1.5} />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Profile Photo</p>
                                </div>

                                {/* Basic Info Fields - READ ONLY */}
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <SaaSInput label="Full Name" value={form.name} readOnly placeholder="Rahul Sharma" />
                                    <SaaSInput label="Personal Email" value={form.personal_email} readOnly icon={Lock} placeholder="email@example.com" />
                                    <SaaSInput label="Phone Number" value={form.phone_1} readOnly placeholder="+91 9876543210" />
                                    <SaaSInput label="Aadhaar Number" value={form.aadhaar_number} readOnly placeholder="XXXX XXXX XXXX" />
                                    <div className="sm:col-span-2">
                                        <SaaSInput label="Emergency Contact" value={form.phone_2} readOnly placeholder="Parent/Guardian Name & Number" />
                                    </div>
                                </div>
                            </div>

                            {/* Subsection: Address - READ ONLY */}
                            <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4 shadow-sm">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <MapPin size={12} /> Residential Address
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="sm:col-span-4">
                                        <SaaSInput label="Street" value={form.address} readOnly placeholder="Street name and House no." />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <SaaSInput label="City" value={form.city} readOnly placeholder="City" />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <SaaSInput label="State" value={form.state} readOnly placeholder="State" />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <SaaSInput label="Pincode" value={form.pincode} readOnly placeholder="Pincode" />
                                    </div>
                                </div>
                            </div>

                            {/* Subsection: Documents */}
                            <div className="space-y-4 pt-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <FileText size={12} /> ID Proofs & Documents
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <DocumentDropBox label="Aadhaar" />
                                    <DocumentDropBox label="College ID" />
                                    <DocumentDropBox label="Other Proof" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Pane: Sidebar (Education & Stats) */}
                    <aside className="w-full lg:w-80 bg-slate-50/70 p-6 sm:p-8 space-y-8 overflow-y-auto">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-indigo-600">
                                <GraduationCap size={16} strokeWidth={2.5} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Education Hub</h3>
                            </div>

                            <div className="space-y-4">
                                <SaaSInput label="College Name" value={form.college_name} readOnly placeholder="College Name" />
                                <SaaSInput label="Course / Degree" value={form.course} readOnly placeholder="B.Tech, MBA etc." />
                                
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Year</label>
                                    <div className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 opacity-70">
                                        {form.year_of_study ? `${form.year_of_study} Year` : 'Not Specified'}
                                    </div>
                                </div>

                                <SaaSInput label="ID / Roll Number" value={form.roll_number} readOnly placeholder="Student ID" />

                                <div className="pt-6">
                                    <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-600/20">
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Status Overview</p>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xl font-black">Verification</h4>
                                            <div className="px-2 py-1 bg-white/20 rounded-lg text-[10px] font-bold">LOCKED</div>
                                        </div>
                                        <p className="text-xs mt-3 opacity-90 leading-relaxed font-medium">Verify documents in the main section to unlock full tenant status.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Sticky Footer - Read-Only View */}
                <div className="px-10 py-6 border-t border-slate-50 bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        <Lock size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Managed by Tenant</span>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                        >
                            Close Profile
                        </button>
                    </div>
                </div>

                {/* Progress Snackbar (Mobile) */}
                <AnimatePresence>
                    {(successMsg || error) && (
                        <motion.div 
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100 }}
                            className={`absolute bottom-6 left-6 right-6 p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between border ${
                                error ? 'bg-rose-600 border-rose-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                                <span className="text-sm font-bold">{successMsg || error}</span>
                            </div>
                            <button onClick={() => { setSuccessMsg(''); setError(''); }}>
                                <X size={20} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

// Internal Styled Input Component
function SaaSInput({ label, value, onChange, placeholder, readOnly = false, icon: Icon }) {
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
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1 group-focus-within:text-indigo-600 transition-colors">
                {label}
            </label>
            <div className="relative">
                <input 
                    type="text"
                    value={displayValue}
                    onChange={e => {
                        let v = e.target.value;
                        if (label === 'Aadhaar Number') {
                             v = v.replace(/\D/g, '').substring(0, 12);
                        }
                        onChange?.(v);
                    }}
                    onFocus={() => label === 'Aadhaar Number' && setIsMasked(false)}
                    onBlur={() => label === 'Aadhaar Number' && setIsMasked(true)}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className={`w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-400 transition-all placeholder:text-slate-200 hover:bg-slate-50 ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                />
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
    );
}

// Internal Styled Document Box
function DocumentDropBox({ label }) {
    return (
        <div className="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group flex flex-col items-center justify-center gap-2 min-h-[140px]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Upload size={18} className="text-slate-400 group-hover:text-indigo-600" />
            </div>
            <div>
                <p className="text-[11px] font-black text-slate-700 group-hover:text-indigo-700">{label}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">PDF, JPG (Max 5MB)</p>
            </div>
        </div>
    );
}
