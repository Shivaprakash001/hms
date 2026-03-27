import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, X, FileText, CheckCircle2, AlertCircle, Loader2,
    Download, Trash2, Shield, Eye
} from 'lucide-react';
import { tenantDocumentService } from '../../api/services';

const DOC_TYPES = [
    { key: 'AADHAR', label: 'Aadhar Card', color: 'indigo' },
    { key: 'DRIVING_LICENSE', label: 'Driving License', color: 'emerald' },
    { key: 'PASSPORT', label: 'Passport', color: 'purple' },
];

export default function DocumentUploadWidget({ tenantId, isOwner = true }) {
    const [activeDocType, setActiveDocType] = useState('AADHAR');
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [docNumbers, setDocNumbers] = useState({ AADHAR: '', DRIVING_LICENSE: '', PASSPORT: '' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (tenantId) fetchDocuments();
    }, [tenantId]);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const data = await tenantDocumentService.getAll(tenantId);
            setDocuments(Array.isArray(data) ? data : []);

            // Pre-fill document numbers
            const nums = { AADHAR: '', DRIVING_LICENSE: '', PASSPORT: '' };
            (Array.isArray(data) ? data : []).forEach(doc => {
                if (doc.document_number) nums[doc.doc_type] = doc.document_number;
            });
            setDocNumbers(nums);
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file) => {
        if (!file) return;

        // Validate
        if (file.size > 5 * 1024 * 1024) {
            setError('File must be less than 5MB');
            return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'pdf', 'webp'].includes(ext)) {
            setError('Only JPG, PNG, WebP, and PDF files are allowed');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess('');
        try {
            await tenantDocumentService.upload(tenantId, activeDocType, docNumbers[activeDocType] || null, file);
            setSuccess(`${DOC_TYPES.find(d => d.key === activeDocType)?.label} uploaded successfully!`);
            setTimeout(() => setSuccess(''), 3000);
            fetchDocuments();
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'object' ? detail.message : detail || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            await tenantDocumentService.delete(tenantId, docId);
            setSuccess('Document deleted');
            setTimeout(() => setSuccess(''), 2000);
            fetchDocuments();
        } catch (err) {
            setError('Failed to delete document');
        }
    };

    const handleVerify = async (docId) => {
        try {
            await tenantDocumentService.verify(tenantId, docId);
            setSuccess('Document verified!');
            setTimeout(() => setSuccess(''), 2000);
            fetchDocuments();
        } catch (err) {
            setError('Failed to verify document');
        }
    };

    const currentDoc = documents.find(d => d.doc_type === activeDocType);

    return (
        <div className="space-y-5">
            {/* Doc Type Tabs */}
            <div className="flex gap-2">
                {DOC_TYPES.map(dt => {
                    const doc = documents.find(d => d.doc_type === dt.key);
                    return (
                        <button
                            key={dt.key}
                            onClick={() => setActiveDocType(dt.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                activeDocType === dt.key
                                    ? `bg-${dt.color}-50 text-${dt.color}-600 border-${dt.color}-200`
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <FileText size={14} />
                            {dt.label}
                            {doc?.verified && <CheckCircle2 size={12} className="text-emerald-500" />}
                            {doc && !doc.verified && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                        </button>
                    );
                })}
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                        <AlertCircle size={14} /> {error}
                        <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
                    </motion.div>
                )}
                {success && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                        <CheckCircle2 size={14} /> {success}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Document Number Input */}
            <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Document Number
                </label>
                <input
                    type="text"
                    value={docNumbers[activeDocType]}
                    onChange={e => setDocNumbers(prev => ({ ...prev, [activeDocType]: e.target.value }))}
                    placeholder={`Enter ${DOC_TYPES.find(d => d.key === activeDocType)?.label} number`}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all hover:bg-white"
                />
            </div>

            {/* Upload Area / Existing Document */}
            {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 size={20} className="animate-spin mr-2" /> Loading documents...
                </div>
            ) : currentDoc ? (
                /* Show existing document */
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                <FileText size={24} className="text-indigo-500" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 text-sm">
                                    {DOC_TYPES.find(d => d.key === activeDocType)?.label}
                                </p>
                                {currentDoc.document_number && (
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        No: {currentDoc.document_number}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                    {currentDoc.verified ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                            <CheckCircle2 size={10} /> Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100">
                                            <AlertCircle size={10} /> Pending Verification
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {currentDoc.signed_url && (
                                <a
                                    href={currentDoc.signed_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="View/Download"
                                >
                                    <Eye size={16} />
                                </a>
                            )}
                            {isOwner && !currentDoc.verified && (
                                <button
                                    onClick={() => handleVerify(currentDoc.id)}
                                    className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                                    title="Verify Document"
                                >
                                    <Shield size={16} />
                                </button>
                            )}
                            {isOwner && (
                                <button
                                    onClick={() => handleDelete(currentDoc.id)}
                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                    title="Delete Document"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Re-upload option */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors"
                        >
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            {uploading ? 'Uploading...' : 'Replace Document'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={e => e.target.files[0] && handleUpload(e.target.files[0])}
                        />
                    </div>
                </div>
            ) : (
                /* Upload area */
                <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="text-sm font-bold text-indigo-600">Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-100 transition-colors">
                                <Upload size={24} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            </div>
                            <p className="text-sm font-bold text-slate-600">
                                Click to upload {DOC_TYPES.find(d => d.key === activeDocType)?.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP or PDF • Max 5MB</p>
                        </>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={e => e.target.files[0] && handleUpload(e.target.files[0])}
                    />
                </div>
            )}
        </div>
    );
}
