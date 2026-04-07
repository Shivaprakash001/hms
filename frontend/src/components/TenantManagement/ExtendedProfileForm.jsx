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

                {/* Scrolling Content */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 space-y-12 scroll-smooth">
                    {/* Section 1: Personal Information */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Personal Information</h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-indigo-50 to-transparent"></div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-10">
                            {/* Profile Photo Upload */}
                            <div className="flex flex-col items-center gap-4 shrink-0">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-[2rem] bg-slate-50 border-4 border-white shadow-xl overflow-hidden relative">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Camera size={40} strokeWidth={1.5} />
                                            </div>
                                        )}
                                        <label className="absolute inset-0 bg-indigo-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                            <Upload className="text-white mb-1" size={20} />
                                            <span className="text-[10px] font-bold text-white uppercase">Upload</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                                        </label>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Max Size 5MB</p>
                                    <p className="text-[10px] text-slate-300">JPG, PNG or WebP</p>
                                </div>
                            </div>

                            {/* Basic Info Fields */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <SaaSInput 
                                    label="Full Name" 
                                    value={form.name} 
                                    onChange={v => handleChange('name', v)} 
                                    placeholder="Ex: Rahul Sharma" 
                                />
                                <SaaSInput 
                                    label="Personal Email" 
                                    value={form.personal_email} 
                                    readOnly 
                                    icon={Lock}
                                    placeholder="rahul.sharma@email.com" 
                                />
                                <SaaSInput 
                                    label="Phone Number" 
                                    value={form.phone_1} 
                                    onChange={v => handleChange('phone_1', v)} 
                                    placeholder="Ex: +91 9876543210" 
                                />
                                <SaaSInput 
                                    label="Aadhaar Number" 
                                    value={form.aadhaar_number} 
                                    onChange={v => handleChange('aadhaar_number', v)} 
                                    placeholder="Enter 12-digit Aadhaar number" 
                                />
                                <SaaSInput 
                                    label="Emergency Contact" 
                                    value={form.phone_2} 
                                    onChange={v => handleChange('phone_2', v)} 
                                    placeholder="Ex: +91 9123456789" 
                                />
                            </div>
                        </div>

                        {/* Subsection: Address */}
                        <div className="bg-slate-50/50 p-6 sm:p-8 rounded-[2rem] border border-slate-100 space-y-6">
                            <div className="flex items-center gap-2">
                                <MapPin size={16} className="text-indigo-500" />
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Residential Address</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-6">
                                <div className="sm:col-span-6">
                                    <SaaSInput 
                                        label="Street Address" 
                                        value={form.address} 
                                        onChange={v => handleChange('address', v)} 
                                        placeholder="Flat, House no, Building, Company, Apartment" 
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <SaaSInput 
                                        label="City" 
                                        value={form.city} 
                                        onChange={v => handleChange('city', v)} 
                                        placeholder="Ex: Mumbai" 
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <SaaSInput 
                                        label="State" 
                                        value={form.state} 
                                        onChange={v => handleChange('state', v)} 
                                        placeholder="Ex: Maharashtra" 
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <SaaSInput 
                                        label="Pincode" 
                                        value={form.pincode} 
                                        onChange={v => handleChange('pincode', v)} 
                                        placeholder="6 digits" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Subsection: Documents */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-indigo-500" />
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Verification Documents</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <DocumentDropBox label="Aadhaar Upload" />
                                <DocumentDropBox label="College ID Upload" />
                                <DocumentDropBox label="Other Document" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Education Information */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Education Info</h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-indigo-50 to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <SaaSInput 
                                label="College Name" 
                                value={form.college_name} 
                                onChange={v => handleChange('college_name', v)} 
                                placeholder="Ex: VIT University" 
                            />
                            <SaaSInput 
                                label="Course / Degree" 
                                value={form.course} 
                                onChange={v => handleChange('course', v)} 
                                placeholder="Ex: B.Tech Computer Science" 
                            />
                            <select 
                                value={form.year_of_study} 
                                onChange={e => handleChange('year_of_study', e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-400 transition-all cursor-pointer appearance-none"
                            >
                                <option value="">Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                                <option value="5">5th Year+</option>
                            </select>
                            <SaaSInput 
                                label="Student ID / Roll No" 
                                value={form.roll_number} 
                                onChange={v => handleChange('roll_number', v)} 
                                placeholder="Ex: 2021BCS0042" 
                            />
                        </div>
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="px-10 py-6 border-t border-slate-50 bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Info size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">All data is encrypted</span>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={saving}
                            className="px-8 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Changes'}
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
    return (
        <div className="space-y-2 group">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 ml-1 group-focus-within:text-indigo-600 transition-colors">
                {label}
            </label>
            <div className="relative">
                <input 
                    type="text"
                    value={label === 'Aadhaar Number' ? (value ? value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim() : '') : (value || '')}
                    onChange={e => {
                        let v = e.target.value;
                        if (label === 'Aadhaar Number') {
                             v = v.replace(/\D/g, '').substring(0, 12);
                        }
                        onChange?.(v);
                    }}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className={`w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-400 transition-all placeholder:text-slate-300 hover:bg-white ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                />
                {Icon && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Icon size={16} />
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
