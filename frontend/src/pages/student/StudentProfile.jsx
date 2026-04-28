import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, MapPin, Camera, Save, Edit2, Key, Building2, CheckCircle2, GraduationCap, Briefcase, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../api/services';
import DocumentUploadWidget from '../../components/TenantManagement/DocumentUploadWidget';

const StudentProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [studentInfo, setStudentInfo] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const fileInputRef = useRef(null);

    // Local State for Form Data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        emergency_contact: '',
        address: '',
        personal_email: '',
        phone_1: '',
        phone_2: '',
        phone_3: '',
        college_name: '',
        roll_number: '',
        course: '',
        year_of_study: '',
        section: '',
        branch: '',
        office_name: '',
        office_location: '',
        job_role: '',
        permanent_address: '',
        temporary_address: '',
        gender: '',
        photo_url: '',
        profile_type: 'student'
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id) return;
            try {
                let meData = null;
                try {
                    meData = await studentService.getMyProfile();
                } catch {
                    meData = await studentService.getByProfileId(user.id);
                }

                const studentRecord = meData?.student_details || meData || {};
                const apiProfile = meData?.profile || {};
                const profRel = meData?.profile || meData?.profiles;
                const prof = Array.isArray(profRel) ? (profRel[0] || {}) : (profRel || {});
                setStudentInfo(meData);
                const inferredType = (studentRecord.office_name || studentRecord.job_role || studentRecord.office_location) ? 'work' : 'student';
                setFormData({
                    name: prof.name || user?.name || '',
                    email: prof.email || user?.email || '',
                    phone: prof.phone || '',
                    emergency_contact: prof.emergency_contact || '',
                    address: prof.address || '',
                    personal_email: apiProfile.personal_email || studentRecord.personal_email || '',
                    phone_1: studentRecord.phone_1 || '',
                    phone_2: studentRecord.phone_2 || '',
                    phone_3: studentRecord.phone_3 || '',
                    college_name: studentRecord.college_name || '',
                    roll_number: studentRecord.roll_number || '',
                    course: studentRecord.course || '',
                    year_of_study: studentRecord.year_of_study || '',
                    section: studentRecord.section || '',
                    branch: studentRecord.branch || '',
                    office_name: studentRecord.office_name || '',
                    office_location: studentRecord.office_location || '',
                    job_role: studentRecord.job_role || '',
                    permanent_address: apiProfile.permanent_address || studentRecord.permanent_address || '',
                    temporary_address: apiProfile.temporary_address || studentRecord.temporary_address || '',
                    gender: apiProfile.gender || studentRecord.gender || '',
                    photo_url: studentRecord.photo_url || '',
                    profile_type: inferredType
                });
            } catch (error) {
                console.error("Failed to fetch profile data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const profileCompletion = useMemo(() => {
        const isFilled = (val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'string') return val.trim().length > 0;
            return Boolean(val);
        };

        const checks = [
            isFilled(formData.name),
            isFilled(formData.email),
            isFilled(formData.phone),
            isFilled(formData.emergency_contact),
            isFilled(formData.personal_email),
            isFilled(formData.permanent_address),
            isFilled(formData.temporary_address),
            isFilled(formData.gender),
        ];
        const completed = checks.filter(Boolean).length;
        const total = checks.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, total, percent };
    }, [formData]);

    const handleSave = async () => {
        setSaveLoading(true);
        try {
            const optional = (value) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    return trimmed === '' ? null : trimmed;
                }
                return value;
            };

            const payload = {
                name: formData.name,
                email: formData.email,
                phone: optional(formData.phone),
                emergency_contact: optional(formData.emergency_contact),
                address: optional(formData.address),
                personal_email: optional(formData.personal_email),
                phone_1: optional(formData.phone || formData.phone_1),
                phone_2: optional(formData.emergency_contact || formData.phone_2),
                phone_3: null,
                college_name: optional(formData.profile_type === 'student' ? formData.college_name : null),
                roll_number: optional(formData.profile_type === 'student' ? formData.roll_number : null),
                course: optional(formData.profile_type === 'student' ? formData.course : null),
                year_of_study: formData.profile_type === 'student' && formData.year_of_study ? Number(formData.year_of_study) : null,
                section: optional(formData.profile_type === 'student' ? formData.section : null),
                branch: optional(formData.profile_type === 'student' ? formData.branch : null),
                office_name: optional(formData.profile_type === 'work' ? formData.office_name : null),
                office_location: optional(formData.profile_type === 'work' ? formData.office_location : null),
                job_role: optional(formData.profile_type === 'work' ? formData.job_role : null),
                permanent_address: optional(formData.permanent_address),
                temporary_address: optional(formData.temporary_address),
                gender: formData.gender === 'Prefer not to say' ? null : optional(formData.gender),
                photo_url: optional(formData.photo_url)
            };
            const updated = await studentService.updateMyProfile(payload);
            const profRel = updated?.profile || updated?.profiles;
            const prof = Array.isArray(profRel) ? (profRel[0] || {}) : (profRel || {});
            setStudentInfo(updated);
            setFormData((prev) => ({
                ...prev,
                name: prof.name || user?.name || prev.name,
                email: prof.email || user?.email || prev.email,
                phone: prof.phone || prev.phone,
                emergency_contact: prof.emergency_contact || prev.emergency_contact,
                address: prof.address || prev.address,
                personal_email: updated.personal_email || prev.personal_email,
                phone_1: updated.phone_1 || prev.phone_1,
                phone_2: updated.phone_2 || prev.phone_2,
                phone_3: updated.phone_3 || prev.phone_3,
                college_name: updated.college_name || prev.college_name,
                roll_number: updated.roll_number || prev.roll_number,
                course: updated.course || prev.course,
                year_of_study: updated.year_of_study || prev.year_of_study,
                section: updated.section || prev.section,
                branch: updated.branch || prev.branch,
                office_name: updated.office_name || prev.office_name,
                office_location: updated.office_location || prev.office_location,
                job_role: updated.job_role || prev.job_role,
                permanent_address: updated.permanent_address || prev.permanent_address,
                temporary_address: updated.temporary_address || prev.temporary_address,
                gender: updated.gender || prev.gender,
                photo_url: updated.photo_url || prev.photo_url,
                profile_type: (updated.office_name || updated.job_role || updated.office_location) ? 'work' : (updated.college_name || updated.branch ? 'student' : prev.profile_type),
            }));
            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update profile:", error);
            const detail = error?.response?.data?.detail;
            const message = Array.isArray(detail)
                ? detail.map(d => d?.msg).filter(Boolean).join(', ')
                : (typeof detail === 'string' ? detail : (detail?.message || 'Failed to update profile'));
            alert(message);
        } finally {
            setSaveLoading(false);
        }
    };

    const handlePhotoPick = () => {
        if (!isEditing) return;
        fileInputRef.current?.click();
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPG/PNG/WebP).');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setFormData(prev => ({ ...prev, photo_url: reader.result }));
        };
        reader.readAsDataURL(file);
    };



    if (loading) return <div className="flex items-center justify-center min-h-[400px]">Loading profile...</div>;

    const currentRoom = studentInfo?.current_room || null;
    const roomNo = currentRoom?.room_no || user?.room_no || 'Unassigned';
    const floorNo = currentRoom?.floor_id;

    return (
        <div className="max-w-4xl mx-auto pb-16 animate-fade-in-up space-y-5">

            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <div className="fixed top-24 right-8 z-50 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Profile updated successfully!
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                <div className="relative">
                    <img
                        src={formData.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border border-slate-200"
                    />
                    {isEditing && (
                        <button
                            onClick={handlePhotoPick}
                            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow hover:bg-indigo-700"
                        >
                            <Camera size={14} />
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                    />
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <h1 className="text-xl font-bold text-slate-900">{formData.name || user?.name || 'Student'}</h1>
                    <p className="text-sm text-slate-500">{formData.email || user?.email || 'N/A'}</p>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">Room {roomNo}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">{studentInfo?.status || 'Resident'}</span>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Profile Completion</p>
                            <p className="text-xs font-bold text-indigo-600">{profileCompletion.percent}%</p>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 transition-all duration-500"
                                style={{ width: `${profileCompletion.percent}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            {profileCompletion.completed} of {profileCompletion.total} profile sections completed
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleSave} className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5" disabled={saveLoading}>
                                {saveLoading ? 'Saving...' : 'Save'} {!saveLoading && <Save size={12} />}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                            Edit <Edit2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Basic details */}
            <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoField label="Full Name" value={formData.name} icon={User} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    <InfoField label="Email" value={formData.email} icon={Mail} isEditable={isEditing} type="email" onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    <InfoField label="Phone" value={formData.phone} icon={Phone} isEditable={isEditing} type="tel" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    <InfoField label="Emergency Contact" value={formData.emergency_contact} icon={Phone} isEditable={isEditing} type="tel" onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} />
                    <InfoField
                        label="Gender"
                        value={formData.gender}
                        icon={User}
                        isEditable={isEditing}
                        type="select"
                        options={['Male', 'Female', 'Other', 'Prefer not to say']}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    />
                    <InfoField label="Personal Email" value={formData.personal_email} icon={Mail} isEditable={isEditing} type="email" onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })} />
                    <InfoField label="Temporary Address" value={formData.temporary_address || formData.address} icon={MapPin} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, temporary_address: e.target.value, address: e.target.value })} />
                    <div className="md:col-span-2">
                        <InfoField label="Permanent Address" value={formData.permanent_address} icon={MapPin} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, permanent_address: e.target.value })} />
                    </div>
                </div>
            </section>

            {/* Student/Work slider */}
            <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Profile Type</h3>

                <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4">
                    <button
                        disabled={!isEditing}
                        onClick={() => setFormData(prev => ({ ...prev, profile_type: 'student' }))}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${formData.profile_type === 'student' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
                    >
                        <span className="inline-flex items-center gap-2"><GraduationCap size={14} /> Student</span>
                    </button>
                    <button
                        disabled={!isEditing}
                        onClick={() => setFormData(prev => ({ ...prev, profile_type: 'work' }))}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${formData.profile_type === 'work' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
                    >
                        <span className="inline-flex items-center gap-2"><Briefcase size={14} /> Work</span>
                    </button>
                </div>

                {formData.profile_type === 'student' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoField label="College" value={formData.college_name} icon={GraduationCap} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, college_name: e.target.value })} />
                        <InfoField label="Roll Number" value={formData.roll_number} icon={GraduationCap} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })} />
                        <InfoField label="Course" value={formData.course} icon={GraduationCap} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, course: e.target.value })} />
                        <InfoField label="Year of Study" value={formData.year_of_study} icon={GraduationCap} isEditable={isEditing} type="number" onChange={(e) => setFormData({ ...formData, year_of_study: e.target.value })} />
                        <InfoField label="Section" value={formData.section} icon={GraduationCap} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, section: e.target.value })} />
                        <InfoField label="Branch" value={formData.branch} icon={GraduationCap} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoField label="Company" value={formData.office_name} icon={Building2} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, office_name: e.target.value })} />
                        <InfoField label="Job Role" value={formData.job_role} icon={Briefcase} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, job_role: e.target.value })} />
                        <div className="md:col-span-2">
                            <InfoField label="Office Location" value={formData.office_location} icon={MapPin} isEditable={isEditing} onChange={(e) => setFormData({ ...formData, office_location: e.target.value })} />
                        </div>
                    </div>
                )}
            </section>

            {/* Hostel summary */}
            <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-3">Hostel Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <InfoBadge label="Room" value={roomNo} />
                    <InfoBadge label="Floor" value={floorNo ? `Floor ${floorNo}` : 'N/A'} />
                    <InfoBadge label="Joined" value={studentInfo?.joined_on || 'N/A'} />
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h3>
                    <button
                        onClick={() => navigate('/student/settings')}
                        className="w-full flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    >
                        <Key size={16} /> Change Password
                    </button>
                </section>

                <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={16} className="text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Documents</h3>
                    </div>
                    {studentInfo?.id ? (
                        <DocumentUploadWidget
                            tenantId={studentInfo.id}
                            isOwner={false}
                        />
                    ) : (
                        <p className="text-sm text-slate-400">No tenant record found.</p>
                    )}
                </section>
            </div>
        </div>
    );
};

const InfoField = ({ label, value, icon, isEditable, onChange, type = "text", options = [] }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide ml-1">{label}</label>
        {isEditable ? (
            <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400">
                    {icon ? React.createElement(icon, { size: 16 }) : null}
                </div>
                {type === 'select' ? (
                    <select
                        value={value || ''}
                        onChange={onChange}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900"
                    >
                        <option value="">Select</option>
                        {options.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={type}
                        value={value || ''}
                        onChange={onChange}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900"
                    />
                )}
            </div>
        ) : (
            <div className="flex items-center gap-3 p-2 text-slate-700">
                <div className="text-slate-400">
                    {icon ? React.createElement(icon, { size: 18 }) : null}
                </div>
                <span className="font-medium">{value || 'N/A'}</span>
            </div>
        )}
    </div>
);

const InfoBadge = ({ label, value }) => (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
        <p className="text-slate-800 font-semibold mt-0.5">{value || 'N/A'}</p>
    </div>
);

export default StudentProfile;
