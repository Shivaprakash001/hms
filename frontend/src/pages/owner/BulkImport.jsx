import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertTriangle, FileSpreadsheet, HelpCircle } from 'lucide-react';
import { useHostelContext } from '../../context/HostelContext';
import { apiService } from '../../api/services';

export default function BulkImport() {
    const navigate = useNavigate();
    const { hostelId } = useHostelContext();
    const [file, setFile] = useState(null);
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

            const response = await fetch('/api/bulk-import/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Navigate to confirmation page
            navigate(`/owner/bulk-import/${result.batch_id}/confirm`);
        } catch (err) {
            setError(err.message || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="font-sans pb-20">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bulk Tenant Import</h1>
                    <p className="text-slate-500 text-sm mt-2">
                        Upload an Excel file to import multiple tenants at once
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

                {/* Upload Form */}
                <div className="bg-white shadow-lg rounded-[2.5rem] border border-slate-100 p-8">
                    <div className="space-y-6">
                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">
                                <FileSpreadsheet className="inline mr-2 mb-1" size={16} />
                                Upload Excel File
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
                                        <span>Upload & Validate</span>
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
                            <h3 className="text-sm font-bold text-blue-900 mb-3">Required Columns</h3>
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
                                    <span className="font-bold min-w-[180px]">monthly_rent</span>
                                    <span>Monthly rent amount (required)</span>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
