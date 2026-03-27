import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, User, Phone, Mail, Building2, MapPin, GraduationCap,
    Briefcase, Camera, Upload, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { studentService } from '../../api/services';
import DocumentUploadWidget from './DocumentUploadWidget';

const TABS = [
    { key: 'personal', label: 'Personal Info', icon: User },
    { key: 'contact', label: 'Contact', icon: Phone },
    { key: 'education', label: 'Education / Work', icon: GraduationCap },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'documents', label: 'Documents', icon: Briefcase },
];

export default function ExtendedProfileForm({ isOpen, onClose, student, onSave }) {
    const [activeTab, setActiveTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');
    const [photoPreview, setPhotoPreview] = useState(null);

    const [form, setForm] = useState({
        photo_url: '',
        phone_1: '',
        phone_2: '',
        phone_3: '',
        personal_email: '',
        college_name: '',
        branch: '',
        office_name: '',
        office_location: '',
        job_role: '',
        permanent_address: '',
        temporary_address: '',
    });

    // Profile type toggle: student vs working professional
    const [profileType, setProfileType] = useState('student');

    useEffect(() => {
        if (student) {
            setForm({
                photo_url: student.photo_url || '',
                phone_1: student.phone_1 || '',
                phone_2: student.phone_2 || '',
                phone_3: student.phone_3 || '',
                personal_email: student.personal_email || '',
                college_name: student.college_name || '',
                branch: student.branch || '',
                office_name: student.office_name || '',
                office_location: student.office_location || '',
                job_role: student.job_role || '',
                permanent_address: student.permanent_address || '',
                temporary_address: student.temporary_address || '',
            });

            // Auto-detect profile type
            if (student.office_name || student.job_role) {
                setProfileType('working');
            } else {
                setProfileType('student');
            }

            setPhotoPreview(student.photo_url || null);
        }
    }, [student]);

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
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        try {
            // Filter out empty strings — only send fields with actual values
            const payload = {};
            Object.entries(form).forEach(([key, val]) => {
                if (val && val.trim()) {
                    payload[key] = val.trim();
                }
            });

            await studentService.update(student.id, payload);
            setSuccessMsg('Profile updated successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
            if (onSave) onSave();
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'object' ? detail.message : detail || err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative z-10 flex flex-col"
            >
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Extended Profile</h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {student?.profile?.name || student?.name || 'Tenant'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-8 pt-4 border-b border-slate-100 flex gap-1 overflow-x-auto shrink-0">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Alerts */}
                <AnimatePresence>
                    {successMsg && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mx-8 mt-4 bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0">
                            <CheckCircle2 size={16} /> {successMsg}
                        </motion.div>
                    )}
                    {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mx-8 mt-4 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0">
                            <AlertCircle size={16} /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'personal' && (
                        <div className="space-y-6">
                            {/* Photo Upload */}
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-lg">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Camera size={28} />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl cursor-pointer transition-opacity">
                                        <Upload size={18} className="text-white" />
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                                    </label>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">Profile Photo</p>
                                    <p className="text-xs text-slate-400">JPG, PNG or WebP. Max 5MB</p>
                                </div>
                            </div>

                            <FormField label="Personal Email" value={form.personal_email} onChange={v => handleChange('personal_email', v)} type="email" icon={Mail} placeholder="personal@email.com" />
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="space-y-5">
                            <FormField label="Phone 1 (Primary)" value={form.phone_1} onChange={v => handleChange('phone_1', v)} type="tel" icon={Phone} placeholder="+91 9876543210" />
                            <FormField label="Phone 2 (Parent / Guardian)" value={form.phone_2} onChange={v => handleChange('phone_2', v)} type="tel" icon={Phone} placeholder="+91 9876543210" />
                            <FormField label="Phone 3 (Optional)" value={form.phone_3} onChange={v => handleChange('phone_3', v)} type="tel" icon={Phone} placeholder="+91 9876543210" />
                        </div>
                    )}

                    {activeTab === 'education' && (
                        <div className="space-y-6">
                            {/* Toggle */}
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1.5 w-fit">
                                <button
                                    onClick={() => setProfileType('student')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        profileType === 'student' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                                    }`}
                                >
                                    <GraduationCap size={14} className="inline mr-1.5" />Student
                                </button>
                                <button
                                    onClick={() => setProfileType('working')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        profileType === 'working' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                                    }`}
                                >
                                    <Briefcase size={14} className="inline mr-1.5" />Working Professional
                                </button>
                            </div>

                            {profileType === 'student' ? (
                                <div className="space-y-5">
                                    <FormField label="College / University" value={form.college_name} onChange={v => handleChange('college_name', v)} icon={GraduationCap} placeholder="e.g. VTU, JNTU" />
                                    <FormField label="Branch / Department" value={form.branch} onChange={v => handleChange('branch', v)} icon={GraduationCap} placeholder="e.g. Computer Science" />
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <FormField label="Company / Office Name" value={form.office_name} onChange={v => handleChange('office_name', v)} icon={Building2} placeholder="e.g. TCS, Infosys" />
                                    <FormField label="Office Location" value={form.office_location} onChange={v => handleChange('office_location', v)} icon={MapPin} placeholder="e.g. Electronic City, Bangalore" />
                                    <FormField label="Job Role / Designation" value={form.job_role} onChange={v => handleChange('job_role', v)} icon={Briefcase} placeholder="e.g. Software Engineer" />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Permanent Address</label>
                                <textarea
                                    value={form.permanent_address}
                                    onChange={e => handleChange('permanent_address', e.target.value)}
                                    rows={3}
                                    placeholder="Full permanent address..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none hover:bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporary / Current Address</label>
                                <textarea
                                    value={form.temporary_address}
                                    onChange={e => handleChange('temporary_address', e.target.value)}
                                    rows={3}
                                    placeholder="Current local address..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none hover:bg-white"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && student && (
                        <DocumentUploadWidget tenantId={student.id} />
                    )}
                </div>

                {/* Footer */}
                {activeTab !== 'documents' && (
                    <div className="px-8 py-4 border-t border-slate-100 flex gap-3 bg-slate-50/50 shrink-0">
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors text-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

// Reusable form field component
function FormField({ label, value, onChange, type = 'text', icon: Icon, placeholder }) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Icon size={16} />
                    </div>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all hover:bg-white`}
                />
            </div>
        </div>
    );
}
