import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Upload } from 'lucide-react';

export default function BulkImportConfirm() {
    const navigate = useNavigate();
    const { batchId } = useParams();
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState(null);
    const [importResult, setImportResult] = useState(null);

    // Placeholder validation data (would come from API in production)
    const [validation] = useState({
        total_rows: 0,
        valid: 0,
        invalid: 0,
        duplicates: 0,
        warnings: [],
    });

    const handleConfirm = async () => {
        setIsImporting(true);
        setError(null);

        try {
            const response = await fetch(`/api/bulk-import/${batchId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Import failed');
            }

            setImportResult(result);
        } catch (err) {
            setError(err.message || 'Import failed. Please try again.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleCancel = () => {
        navigate('/owner/bulk-import');
    };

    // Success Screen
    if (importResult) {
        return (
            <div className="font-sans pb-20">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Success Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                                    🎉 Import Successful!
                                </h3>
                                <div className="text-sm text-emerald-800 space-y-1">
                                    <p>
                                        <strong className="text-lg">{importResult.result?.success_count || 0}</strong> tenants imported successfully.
                                    </p>
                                    {importResult.result?.failure_count > 0 && (
                                        <p>
                                            <strong>{importResult.result.failure_count}</strong> tenants failed (see details below).
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Reminder */}
                    <div className="bg-rose-50 border-l-4 border-rose-400 rounded-xl p-6">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-6 w-6 text-rose-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-rose-900 mb-2">
                                    IMPORTANT: Delete Your Excel File
                                </h3>
                                <div className="text-sm text-rose-800 space-y-2">
                                    <p>
                                        Now that import is complete, permanently delete the XLSX file you uploaded.
                                        It contains temporary passwords that should not be stored.
                                    </p>
                                    <div className="mt-3 flex items-center">
                                        <input
                                            type="checkbox"
                                            id="deleted"
                                            className="h-4 w-4 text-rose-600 rounded border-slate-300"
                                        />
                                        <label htmlFor="deleted" className="ml-2 text-sm font-semibold text-rose-800">
                                            I have deleted the Excel file
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Failure Details */}
                    {importResult.result?.failures && importResult.result.failures.length > 0 && (
                        <div className="bg-white shadow-lg rounded-2xl border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Failed Imports</h3>
                            <div className="space-y-3">
                                {importResult.result.failures.map((failure, idx) => (
                                    <div key={idx} className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                        <p className="text-sm font-bold text-rose-900">Row {failure.row}</p>
                                        <p className="text-sm text-rose-700 mt-1">{failure.error}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/owner/tenants')}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                        >
                            View Imported Tenants
                        </button>
                        <button
                            onClick={() => navigate('/owner/bulk-import')}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 px-6 rounded-xl font-bold transition-all active:scale-95"
                        >
                            Import More Tenants
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Confirmation Screen
    return (
        <div className="font-sans pb-20">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Confirm Import</h1>
                    <p className="text-slate-500 text-sm mt-2">
                        Review the validation results before proceeding with the import
                    </p>
                </div>

                {/* Validation Summary */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white shadow-lg rounded-2xl border border-slate-100 p-6">
                        <p className="text-sm font-semibold text-slate-500 mb-2">Total Rows</p>
                        <p className="text-3xl font-black text-slate-900">{validation.total_rows}</p>
                    </div>
                    <div className="bg-emerald-50 shadow-lg rounded-2xl border border-emerald-200 p-6">
                        <p className="text-sm font-semibold text-emerald-700 mb-2">Valid</p>
                        <p className="text-3xl font-black text-emerald-900">{validation.valid}</p>
                    </div>
                    <div className="bg-rose-50 shadow-lg rounded-2xl border border-rose-200 p-6">
                        <p className="text-sm font-semibold text-rose-700 mb-2">Invalid</p>
                        <p className="text-3xl font-black text-rose-900">{validation.invalid}</p>
                    </div>
                    <div className="bg-yellow-50 shadow-lg rounded-2xl border border-yellow-200 p-6">
                        <p className="text-sm font-semibold text-yellow-700 mb-2">Duplicates</p>
                        <p className="text-3xl font-black text-yellow-900">{validation.duplicates}</p>
                    </div>
                </div>

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-yellow-900 mb-3 flex items-center gap-2">
                            <AlertTriangle size={18} />
                            Warnings
                        </h3>
                        <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                            {validation.warnings.map((warning, idx) => (
                                <li key={idx}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <p className="text-sm text-blue-800 font-semibold">
                        <strong>Note:</strong> Validation details will be loaded from the batch. Click "Confirm Import" to proceed with importing valid rows.
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-rose-50 border-l-4 border-rose-400 rounded-xl p-6">
                        <div className="flex gap-3">
                            <XCircle className="h-6 w-6 text-rose-600 flex-shrink-0" />
                            <p className="text-sm font-semibold text-rose-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                    <button
                        onClick={handleCancel}
                        disabled={isImporting}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 px-6 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isImporting || validation.valid === 0}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                            isImporting || validation.valid === 0
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
                        }`}
                    >
                        {isImporting ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>Importing...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                <span>Confirm Import ({validation.valid} valid rows)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
