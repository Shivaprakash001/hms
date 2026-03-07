import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, MapPin, Camera, Save, Edit2, Shield, Key, Building2, Calendar, CheckCircle2, GraduationCap, Download, AlertTriangle, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { profileService, studentService } from '../../api/services';

const StudentProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [studentInfo, setStudentInfo] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Local State for Form Data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        dob: '',
        address: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id) return;
            try {
                const [profData, studData] = await Promise.all([
                    profileService.get(user.id),
                    studentService.getByProfileId(user.id)
                ]);
                setProfile(profData);
                setStudentInfo(studData);
                setFormData({
                    name: profData.name || '',
                    email: profData.email || '',
                    phone: profData.phone || '',
                    dob: profData.dob || '',
                    address: profData.address || ''
                });
            } catch (error) {
                console.error("Failed to fetch profile data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const handleSave = async () => {
        setSaveLoading(true);
        try {
            const updated = await profileService.update(user.id, formData);
            setProfile(updated);
            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("Failed to update profile");
        } finally {
            setSaveLoading(false);
        }
    };



    if (loading) return <div className="flex items-center justify-center min-h-[400px]">Loading profile...</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in-up">

            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-24 right-8 z-50 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm"
                    >
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Profile updated successfully!
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN (70%) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* 1. Profile Header Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                        <div className="relative group shrink-0">
                            <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer transition-opacity">
                                        <Camera size={20} className="text-white" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-2">
                            <h1 className="text-2xl font-bold text-slate-900">{formData.name}</h1>
                            <p className="text-slate-500 text-sm font-medium">{formData.email}</p>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                    Student
                                </span>
                                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100">
                                    Room {user?.roomId || 'N/A'}
                                </span>
                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active Resident
                                </span>
                            </div>
                        </div>

                        <div className="absolute top-6 right-6">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        {saveLoading ? 'Saving...' : 'Save'}
                                        {!saveLoading && <Save size={14} />}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                                >
                                    Edit Profile
                                    <Edit2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 2. Personal Information Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                <User size={18} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <InfoField
                                label="Full Name"
                                value={formData.name}
                                icon={User}
                                isEditable={isEditing}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                            <InfoField
                                label="Date of Birth"
                                value={formData.dob}
                                icon={Calendar}
                                isEditable={isEditing}
                                type="date"
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            />
                            <InfoField
                                label="Email Address"
                                value={formData.email}
                                icon={Mail}
                                isEditable={isEditing}
                                type="email"
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <InfoField
                                label="Phone Number"
                                value={formData.phone}
                                icon={Phone}
                                isEditable={isEditing}
                                type="tel"
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1 mb-1.5 block">Address</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <div className="absolute left-3 top-3 text-slate-400">
                                            <MapPin size={16} />
                                        </div>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            rows={2}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 resize-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3 p-2 text-slate-700">
                                        <div className="text-slate-400 mt-0.5">
                                            <MapPin size={18} />
                                        </div>
                                        <span className="font-medium">{formData.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN (30%) */}
                <div className="lg:col-span-4 space-y-6">

                    {/* 3. Hostel Information Card (Read Only) */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                                <Building2 size={18} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Hostel Info</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                <span className="text-slate-500 text-sm font-medium">Room No.</span>
                                <span className="text-lg font-bold text-slate-800">{studentInfo?.room_no || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                <span className="text-slate-500 text-sm font-medium">Floor</span>
                                <span className="text-slate-800 font-semibold">{studentInfo?.floor_id ? `Floor ${studentInfo.floor_id}` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                <span className="text-slate-500 text-sm font-medium">Joined</span>
                                <span className="text-slate-800 font-semibold">{studentInfo?.joined_on || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Quick Actions Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Quick Actions</h3>

                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/student/settings')}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-colors group border border-slate-100 hover:border-indigo-100"
                            >
                                <div className="flex items-center gap-3">
                                    <Key size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                    <span className="font-semibold text-sm">Change Password</span>
                                </div>
                                <div className="text-slate-300 group-hover:text-indigo-400">→</div>
                            </button>

                            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-colors group border border-slate-100 hover:border-indigo-100">
                                <div className="flex items-center gap-3">
                                    <Download size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                    <span className="font-semibold text-sm">Download ID</span>
                                </div>
                                <div className="text-slate-300 group-hover:text-indigo-400">→</div>
                            </button>

                            <button
                                onClick={() => navigate('/student/complaints')}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-colors group border border-slate-100 hover:border-indigo-100"
                            >
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                    <span className="font-semibold text-sm">Raise Complaint</span>
                                </div>
                                <div className="text-slate-300 group-hover:text-indigo-400">→</div>
                            </button>

                            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-colors group border border-slate-100 hover:border-indigo-100">
                                <div className="flex items-center gap-3">
                                    <PhoneCall size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                    <span className="font-semibold text-sm">Contact Owner</span>
                                </div>
                                <div className="text-slate-300 group-hover:text-indigo-400">→</div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const InfoField = ({ label, value, icon: Icon, isEditable, onChange, type = "text" }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">{label}</label>
        {isEditable ? (
            <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400">
                    <Icon size={16} />
                </div>
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900"
                />
            </div>
        ) : (
            <div className="flex items-center gap-3 p-2 text-slate-700">
                <div className="text-slate-400">
                    <Icon size={18} />
                </div>
                <span className="font-medium">{value}</span>
            </div>
        )}
    </div>
);

export default StudentProfile;
