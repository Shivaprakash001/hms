import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertTriangle, FileSpreadsheet, HelpCircle, IndianRupee, CalendarDays, Clipboard, CheckCircle2 } from 'lucide-react';
import { useHostelContext } from '../../context/HostelContext';
import { bulkImportService } from '../../api/services';

export default function BulkImport() {
    const navigate = useNavigate();
    const { hostelId, activeHostel } = useHostelContext();
    const [file, setFile] = useState(null);
    const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [advanceDeposit, setAdvanceDeposit] = useState('');
    const [maintenanceCharge, setMaintenanceCharge] = useState('');
    const [maintenanceType, setMaintenanceType] = useState('MONTHLY');
    const [billingStartMode, setBillingStartMode] = useState('JOINING_DATE');
    const [promptNotes, setPromptNotes] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState(null);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [promptError, setPromptError] = useState(null);
    const [copyStatus, setCopyStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
        ];

        if (!validTypes.includes(selectedFile.type)) {
            setError('Invalid file type. Please upload XLSX or CSV file.');
            setFile(null);
            return;
        }

        // Validate file size (5MB max)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('File too large. Maximum size is 5MB.');
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleUpload = async () => {
        if (!file || !hostelId) {
            setError('Please select a file and ensure hostel is selected.');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('hostel_id', hostelId);
            formData.append('joining_date', joiningDate);
            formData.append('advance_deposit', advanceDeposit);
            formData.append('maintenance_charge', maintenanceCharge);
            formData.append('maintenance_type', maintenanceType);
            formData.append('billing_start_mode', billingStartMode);

            const response = await fetch('/api/bulk-import/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || result.error || 'Upload failed');
            }

            // Navigate to confirmation page
            navigate(`/hostels/${hostelId}/bulk-import/${result.batch_id}/confirm`);
        } catch (err) {
            setError(err.message || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleGeneratePrompt = async () => {
        if (!hostelId) {
            setPromptError('Hostel context is required before generating a prompt.');
            return;
        }

        setIsGeneratingPrompt(true);
        setPromptError(null);
        setCopyStatus('');

        try {
            const result = await bulkImportService.generateGoogleFormPrompt({
                hostelId,
                notes: promptNotes,
            });
            setGeneratedPrompt(result);
        } catch (err) {
            const message = err?.response?.data?.error?.message || err?.response?.data?.error || err.message;
            setPromptError(message || 'Failed to generate Google Form prompt.');
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const handleCopyPrompt = async () => {
        if (!generatedPrompt?.prompt) return;

        try {
            await navigator.clipboard.writeText(generatedPrompt.prompt);
            setCopyStatus('Prompt copied');
        } catch (err) {
            console.error('Prompt copy failed:', err);
            setCopyStatus('Copy failed');
        }
    };

    return (
        <div className="font-sans pb-20">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tenant Onboarding Campaign</h1>
                    <p className="text-slate-500 text-sm mt-2">
                        Configure owner defaults, collect tenant identity details, and import with room-derived rent.
                    </p>
                </div>

                {/* Security Warning */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-6">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-yellow-900 mb-2">Security Notice</h3>
                            <div className="text-sm text-yellow-800 space-y-2">
                                <p>
                                    For security, <strong>DELETE</strong> the exported XLSX file after successful import.
                                    The file may contain temporary onboarding credentials.
                                </p>
                                <ul className="list-disc list-inside space-y-1 mt-3">
                                    <li>Import completes → Delete Excel file</li>
                                    <li>Change Google Form password after export</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Google Form Prompt Generator */}
                <div className="bg-white shadow-lg rounded-[2.5rem] border border-slate-100 p-8">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Generate Google Form Prompt</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Creates a strict copy-paste prompt using {activeHostel?.name || 'this hostel'} and its active room list.
                            </p>
                        </div>
                        {generatedPrompt?.room_count ? (
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap">
                                {generatedPrompt.room_count} rooms
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-4">
                        <label className="space-y-2 block">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Optional onboarding notes</span>
                            <textarea
                                value={promptNotes}
                                onChange={(e) => setPromptNotes(e.target.value)}
                                rows={3}
                                placeholder="Example: Use your temporary onboarding password during first login."
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none resize-y"
                            />
                        </label>

                        {promptError && (
                            <div className="bg-rose-50 border-l-4 border-rose-400 rounded-xl p-4">
                                <div className="flex gap-3">
                                    <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                                    <p className="text-sm font-semibold text-rose-700">{promptError}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleGeneratePrompt}
                                disabled={!hostelId || isGeneratingPrompt}
                                className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    !hostelId || isGeneratingPrompt
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-95'
                                }`}
                            >
                                {isGeneratingPrompt ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet size={18} />
                                        <span>Generate Prompt</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleCopyPrompt}
                                disabled={!generatedPrompt?.prompt}
                                className={`sm:w-44 py-3 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                    generatedPrompt?.prompt
                                        ? 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <Clipboard size={18} />
                                <span>Copy Prompt</span>
                            </button>
                        </div>

                        {copyStatus && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${
                                copyStatus === 'Prompt copied' ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                                <CheckCircle2 size={16} />
                                <span>{copyStatus}</span>
                            </div>
                        )}

                        {generatedPrompt?.prompt && (
                            <div className="space-y-3">
                                <textarea
                                    readOnly
                                    value={generatedPrompt.prompt}
                                    rows={18}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 font-mono text-slate-800 focus:outline-none"
                                />
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-sm font-bold text-amber-900">Operational Warning</p>
                                    <p className="text-sm text-amber-800 mt-1">{generatedPrompt.warning}</p>
                                    <p className="text-xs text-amber-700 mt-2">
                                        Expected schema: {generatedPrompt.schema?.join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Form */}
                <div className="bg-white shadow-lg rounded-[2.5rem] border border-slate-100 p-8">
                    <div className="space-y-6">
                        {/* Campaign Defaults */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarDays size={18} className="text-slate-500" />
                                <h2 className="text-sm font-bold text-slate-800">Owner Defaults</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Joining Date</span>
                                    <input
                                        type="date"
                                        value={joiningDate}
                                        onChange={(e) => setJoiningDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Billing Start</span>
                                    <select
                                        value={billingStartMode}
                                        onChange={(e) => setBillingStartMode(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="JOINING_DATE">Joining date</option>
                                        <option value="IMPORT_DATE">Import date</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Deposit</span>
                                    <div className="relative">
                                        <IndianRupee size={16} className="absolute left-4 top-3.5 text-slate-400" />
                                        <input
                                            type="number"
                                            min="0"
                                            value={advanceDeposit}
                                            onChange={(e) => setAdvanceDeposit(e.target.value)}
                                            placeholder="Use hostel default"
                                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Maintenance</span>
                                    <div className="grid grid-cols-[1fr_140px] gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={maintenanceCharge}
                                            onChange={(e) => setMaintenanceCharge(e.target.value)}
                                            placeholder="Use default"
                                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <select
                                            value={maintenanceType}
                                            onChange={(e) => setMaintenanceType(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                                        >
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="ONE_TIME">One-time</option>
                                            <option value="NONE">None</option>
                                        </select>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">
                                <FileSpreadsheet className="inline mr-2 mb-1" size={16} />
                                Upload Tenant Identity File
                            </label>
                            <div className="mt-2 flex justify-center px-6 pt-8 pb-8 border-2 border-slate-200 border-dashed rounded-2xl hover:border-slate-300 transition-colors bg-slate-50">
                                <div className="space-y-2 text-center">
                                    <Upload className="mx-auto h-12 w-12 text-slate-400" />
                                    <div className="flex text-sm text-slate-600">
                                        <label
                                            htmlFor="file-upload"
                                            className="relative cursor-pointer bg-white rounded-lg px-3 py-2 font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                        >
                                            <span>Upload a file</span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                className="sr-only"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={handleFileSelect}
                                            />
                                        </label>
                                        <p className="pl-2 pt-2">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-slate-500 font-semibold">
                                        XLSX, XLS, or CSV up to 5MB
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Maximum 150 rows per file
                                    </p>
                                </div>
                            </div>
                            {file && (
                                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                                    <FileSpreadsheet className="text-emerald-600" size={20} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-emerald-900">{file.name}</p>
                                        <p className="text-xs text-emerald-600">
                                            {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-rose-50 border-l-4 border-rose-400 rounded-xl p-4">
                                <div className="flex gap-3">
                                    <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                                    <p className="text-sm font-semibold text-rose-700">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        <div>
                            <button
                                onClick={handleUpload}
                                disabled={!file || !hostelId || isUploading}
                                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    !file || !hostelId || isUploading
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
                                }`}
                            >
                                {isUploading ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Validating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        <span>Review Campaign</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                    <div className="flex gap-3">
                        <HelpCircle className="text-blue-600 flex-shrink-0" size={20} />
                        <div>
                            <h3 className="text-sm font-bold text-blue-900 mb-3">Tenant-Entered Columns</h3>
                            <ul className="text-sm text-blue-800 space-y-2">
                                <li className="flex gap-2">
                                    <span className="font-bold min-w-[180px]">name</span>
                                    <span>Tenant name (required)</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold min-w-[180px]">phone</span>
                                    <span>Phone number, 10 digits (required)</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold min-w-[180px]">room_no</span>
                                    <span>Room number (required)</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold min-w-[180px]">onboarding_password</span>
                                    <span>Password for first login (required, 6+ chars, letter+number)</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold min-w-[180px]">email</span>
                                    <span>Email address (optional but recommended)</span>
                                </li>
                            </ul>
                            <p className="text-sm text-blue-800 mt-4 font-semibold">
                                Rent is resolved from room configuration. Deposit, maintenance, and billing dates come from owner defaults above.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
