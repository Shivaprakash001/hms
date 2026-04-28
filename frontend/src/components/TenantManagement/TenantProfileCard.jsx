import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    User, Phone, Mail, MapPin, GraduationCap, Briefcase, Building2,
    FileText, CheckCircle2, AlertCircle, Calendar, Edit2, Shield, X,
    Camera
} from 'lucide-react';
import { tenantService, tenantDocumentService } from '../../api/services';
import DocumentUploadWidget from './DocumentUploadWidget';

const TABS = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'contact', label: 'Contact', icon: Phone },
    { key: 'education', label: 'Education/Work', icon: GraduationCap },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'documents', label: 'Documents', icon: FileText },
];

export default function TenantProfileCard({ tenantId, onEdit, isOwner = true }) {
    const [tenant, setStudent] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('personal');

    useEffect(() => {
        if (tenantId) fetchData();
    }, [tenantId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [studentData, docsData] = await Promise.all([
                tenantService.getById(tenantId),
                tenantDocumentService.getAll(tenantId).catch(() => [])
            ]);
            setStudent(studentData);
            setDocuments(Array.isArray(docsData) ? docsData : []);
        } catch (err) {
            console.error('Failed to fetch tenant data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100" />
                    <div className="space-y-2">
                        <div className="w-32 h-4 bg-slate-100 rounded" />
                        <div className="w-24 h-3 bg-slate-100 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!tenant) return null;

    const profile = tenant.profile || tenant.profiles || {};
    const docCount = documents.length;
    const verifiedCount = documents.filter(d => d.verified).length;

    return (
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
            {/* Profile Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden border-2 border-white shadow-lg">
                            {tenant.photo_url ? (
                                <img src={tenant.photo_url} alt="Photo" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg">
                                    {(profile.name || '??').substring(0, 2).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{profile.name || 'Unknown'}</h3>
                            <p className="text-xs text-slate-400 font-medium">{profile.email}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    tenant.status === 'ACTIVE'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : 'bg-slate-50 text-slate-500 border-slate-100'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    {tenant.status}
                                </span>
                                {tenant.document_verified ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                        <Shield size={9} /> Verified
                                    </span>
                                ) : docCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100">
                                        <AlertCircle size={9} /> {verifiedCount}/{docCount} Docs
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {onEdit && (
                        <button
                            onClick={() => onEdit(tenant)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Edit2 size={12} /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-slate-100 flex gap-1 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <tab.icon size={12} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {activeTab === 'personal' && (
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="Full Name" value={profile.name} icon={User} />
                        <InfoItem label="Email" value={profile.email} icon={Mail} />
                        <InfoItem label="Personal Email" value={tenant.personal_email} icon={Mail} />
                        <InfoItem label="Joined On" value={tenant.joined_on} icon={Calendar} />
                        <InfoItem label="Monthly Rent" value={tenant.monthly_rent ? `₹${Number(tenant.monthly_rent).toLocaleString()}` : null} icon={Building2} />
                    </div>
                )}

                {activeTab === 'contact' && (
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="Primary Phone" value={profile.phone || tenant.phone_1} icon={Phone} />
                        <InfoItem label="Phone 1" value={tenant.phone_1} icon={Phone} />
                        <InfoItem label="Phone 2 (Parent)" value={tenant.phone_2} icon={Phone} />
                        <InfoItem label="Phone 3" value={tenant.phone_3} icon={Phone} />
                        <InfoItem label="Emergency" value={profile.emergency_contact} icon={Phone} />
                    </div>
                )}

                {activeTab === 'education' && (
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="College" value={tenant.college_name} icon={GraduationCap} />
                        <InfoItem label="Branch" value={tenant.branch} icon={GraduationCap} />
                        <InfoItem label="Office" value={tenant.office_name} icon={Building2} />
                        <InfoItem label="Office Location" value={tenant.office_location} icon={MapPin} />
                        <InfoItem label="Job Role" value={tenant.job_role} icon={Briefcase} />
                    </div>
                )}

                {activeTab === 'address' && (
                    <div className="space-y-4">
                        <InfoItem label="Permanent Address" value={tenant.permanent_address} icon={MapPin} fullWidth />
                        <InfoItem label="Temporary Address" value={tenant.temporary_address} icon={MapPin} fullWidth />
                        <InfoItem label="Profile Address" value={profile.address} icon={MapPin} fullWidth />
                    </div>
                )}

                {activeTab === 'documents' && (
                    <DocumentUploadWidget tenantId={tenantId} isOwner={isOwner} />
                )}
            </div>
        </div>
    );
}

function InfoItem({ label, value, icon: Icon, fullWidth = false }) {
    return (
        <div className={fullWidth ? 'col-span-2' : ''}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-start gap-2">
                {Icon && <Icon size={14} className="text-slate-300 mt-0.5 shrink-0" />}
                <span className="text-sm font-medium text-slate-700">
                    {value || <span className="text-slate-300 italic">Not provided</span>}
                </span>
            </div>
        </div>
    );
}
