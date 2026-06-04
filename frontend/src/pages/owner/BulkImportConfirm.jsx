import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Upload, Clock3, RefreshCw } from 'lucide-react';
import { bulkImportService } from '../../api/services';

function formatCurrency(value) {
    const amount = Number(value || 0);
    return `Rs. ${amount.toLocaleString('en-IN')}`;
}

const fieldLabels = {
    name: 'Full Name',
    phone: 'Phone Number',
    email: 'Email Address',
    room_no: 'Current Room',
    onboarding_password: 'Temporary Onboarding Password',
    joining_date: 'Joining Date',
};

function formatError(error) {
    if (!error) return 'This row needs attention.';
    const field = fieldLabels[error.field] || error.field;
    return field ? `${field}: ${error.message}` : error.message;
}

function rowIdentity(row) {
    const data = row?.data || {};
    const parts = [data.name, data.phone, data.room_no].filter(Boolean);
    return parts.length ? parts.join(' / ') : 'No readable tenant details';
}

function EditableRow({ row, errors, onChange }) {
    const data = row.data;
    const getError = (field) => errors?.find(e => e.field === field)?.message;

    return (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-rose-950">Row {row.row}</p>
                <p className="text-xs font-semibold text-rose-700 truncate">{rowIdentity(row)}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Full Name</label>
                    <input 
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors ${getError('name') ? 'border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}`}
                        value={data.name || ''} 
                        onChange={e => onChange({ ...data, name: e.target.value })} 
                    />
                    {getError('name') && <p className="text-[10px] text-rose-600 leading-tight font-medium">{getError('name')}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Phone</label>
                    <input 
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors ${getError('phone') ? 'border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}`}
                        value={data.phone || ''} 
                        onChange={e => onChange({ ...data, phone: e.target.value })} 
                    />
                    {getError('phone') && <p className="text-[10px] text-rose-600 leading-tight font-medium">{getError('phone')}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Email</label>
                    <input 
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors ${getError('email') ? 'border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}`}
                        value={data.email || ''} 
                        onChange={e => onChange({ ...data, email: e.target.value })} 
                    />
                    {getError('email') && <p className="text-[10px] text-rose-600 leading-tight font-medium">{getError('email')}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Room No</label>
                    <input 
                        className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition-colors ${getError('room_no') ? 'border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}`}
                        value={data.room_no || ''} 
                        onChange={e => onChange({ ...data, room_no: e.target.value })} 
                    />
                    {getError('room_no') && <p className="text-[10px] text-rose-600 leading-tight font-medium">{getError('room_no')}</p>}
                </div>
            </div>
            
            {errors?.filter(e => !['name', 'phone', 'email', 'room_no'].includes(e.field)).map((e, idx) => (
               <p key={idx} className="text-[11px] font-semibold text-rose-600 mt-2 bg-rose-100/50 py-1.5 px-3 rounded-md">{e.message}</p> 
            ))}
        </div>
    );
}

export default function BulkImportConfirm() {
    const navigate = useNavigate();
    const { batchId, hostelId } = useParams();
    const [isImporting, setIsImporting] = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [error, setError] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [batchPreview, setBatchPreview] = useState(null);
    const [editedRows, setEditedRows] = useState({});

    useEffect(() => {
        let cancelled = false;

        async function loadBatchPreview() {
            try {
                const result = await bulkImportService.getBatchPreview(batchId);

                if (!cancelled) {
                    setBatchPreview(result);
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err?.response?.data?.error?.message || err?.response?.data?.error || err.message;
                    setError(message || 'Failed to load import preview');
                }
            }
        }

        loadBatchPreview();
        return () => {
            cancelled = true;
        };
    }, [batchId]);

    const validation = batchPreview?.validation || {
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 0,
        duplicate_rows: 0,
        warnings: 0,
    };
    const invalidRows = batchPreview?.preview?.invalid || [];
    const duplicateRows = batchPreview?.preview?.duplicates || [];
    const isLoadingPreview = !batchPreview && !error;
    const hasEdits = Object.keys(editedRows).length > 0;

    const handleRowChange = (rowNumber, newData) => {
        setEditedRows(prev => ({
            ...prev,
            [rowNumber]: newData
        }));
    };

    const handleRevalidate = async () => {
        setIsRevalidating(true);
        setError(null);
        try {
            const allOriginalRows = [
                ...(batchPreview?.preview?.valid || []),
                ...(batchPreview?.preview?.invalid || []),
                ...(batchPreview?.preview?.duplicates || [])
            ];
            allOriginalRows.sort((a, b) => a.row - b.row);
            
            const payloadRows = allOriginalRows.map(r => {
                if (editedRows[r.row]) {
                    return editedRows[r.row];
                }
                return r.data;
            });

            const result = await bulkImportService.revalidateRows({
                rows: payloadRows,
                hostel_id: hostelId,
                filename: batchPreview?.filename,
                import_defaults: batchPreview?.defaults
            });

            navigate(`/hostels/${hostelId}/bulk-import/${result.batch_id}/confirm`, { replace: true });
            
            setEditedRows({});
            setBatchPreview(result);
        } catch (err) {
            const message = err?.response?.data?.error?.message || err?.response?.data?.error || err.message;
            setError(message || 'Revalidation failed. Please try again.');
        } finally {
            setIsRevalidating(false);
        }
    };

    const handleConfirm = async () => {
        setIsImporting(true);
        setError(null);

        try {
            const result = await bulkImportService.confirmBatchImport(batchId);
            setImportResult(result);
        } catch (err) {
            const message = err?.response?.data?.error?.message || err?.response?.data?.error || err.message;
            setError(message || 'Import failed. Please try again.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleCancel = () => {
        navigate(`/hostels/${hostelId}/bulk-import`);
    };

    // Success Screen
    if (importResult) {
        const failedImports = (importResult.result?.results || []).filter((row) => !row.success);
        const fallbackErrors = importResult.result?.errors || [];

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
                                    Import Successful
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
                    {(failedImports.length > 0 || fallbackErrors.length > 0) && (
                        <div className="bg-white shadow-lg rounded-2xl border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Failed Imports</h3>
                            <div className="space-y-3">
                                {failedImports.map((failure, idx) => (
                                    <div key={idx} className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                        <p className="text-sm font-bold text-rose-900">Row {failure.row}</p>
                                        <p className="text-sm text-rose-700 mt-1 whitespace-pre-wrap">{failure.error || 'Tenant could not be created.'}</p>
                                    </div>
                                ))}
                                {failedImports.length === 0 && fallbackErrors.map((failure, idx) => (
                                    <div key={idx} className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                        <p className="text-sm text-rose-700 whitespace-pre-wrap">{failure}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate(`/hostels/${hostelId}/tenants`)}
                            className="flex-1 bg-ops-accent hover:bg-ops-accent/700 text-white py-3 px-6 rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all active:scale-95"
                        >
                            View Imported Tenants
                        </button>
                        <button
                            onClick={() => navigate(`/hostels/${hostelId}/bulk-import`)}
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
                        Sri Adithya Hostels checked the sheet. Fix invalid rows first, then import the valid tenants.
                    </p>
                </div>

                {/* Validation Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white shadow-lg rounded-2xl border border-slate-100 p-6">
                        <p className="text-sm font-semibold text-slate-500 mb-2">Total Rows</p>
                        <p className="text-3xl font-black text-slate-900">{validation.total_rows}</p>
                    </div>
                    <div className="bg-emerald-50 shadow-lg rounded-2xl border border-emerald-200 p-6">
                        <p className="text-sm font-semibold text-emerald-700 mb-2">Valid</p>
                        <p className="text-3xl font-black text-emerald-900">{validation.valid_rows}</p>
                    </div>
                    <div className="bg-rose-50 shadow-lg rounded-2xl border border-rose-200 p-6">
                        <p className="text-sm font-semibold text-rose-700 mb-2">Invalid</p>
                        <p className="text-3xl font-black text-rose-900">{validation.invalid_rows}</p>
                    </div>
                    <div className="bg-yellow-50 shadow-lg rounded-2xl border border-yellow-200 p-6">
                        <p className="text-sm font-semibold text-yellow-700 mb-2">Duplicates</p>
                        <p className="text-3xl font-black text-yellow-900">{validation.duplicate_rows}</p>
                    </div>
                </div>

                {(validation.invalid_rows > 0 || validation.duplicate_rows > 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h2 className="text-base font-bold text-amber-950">Some rows need your attention</h2>
                                <p className="text-sm text-amber-800 mt-1">
                                    Import is paused. You can edit the problematic rows below and revalidate.
                                </p>
                            </div>
                        </div>
                        {hasEdits && (
                            <button
                                onClick={handleRevalidate}
                                disabled={isRevalidating}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    isRevalidating
                                        ? 'bg-amber-200 text-amber-600 cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95 shadow-amber-500/30'
                                }`}
                            >
                                {isRevalidating ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Checking...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        <span>Revalidate Edits</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Resolved Rent Preview */}
                <div className="bg-white shadow-lg rounded-2xl border border-slate-100 p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Ready to import</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                These rows passed validation. Rent is resolved from room configuration.
                            </p>
                        </div>
                        {isLoadingPreview && (
                            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                                <Clock3 size={14} />
                                Checking sheet
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                                    <th className="py-3 pr-4">Tenant</th>
                                    <th className="py-3 pr-4">Room</th>
                                    <th className="py-3 pr-4">Derived Rent</th>
                                    <th className="py-3 pr-4">Deposit</th>
                                    <th className="py-3 pr-4">Maintenance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(batchPreview?.preview?.valid || []).map((row) => (
                                    <tr key={row.row} className="border-b border-slate-100">
                                        <td className="py-3 pr-4 font-semibold text-slate-900">{row.data.name}</td>
                                        <td className="py-3 pr-4 text-slate-700">{row.data.room_no}</td>
                                        <td className="py-3 pr-4 font-bold text-emerald-700">{formatCurrency(row.data.monthly_rent)}</td>
                                        <td className="py-3 pr-4 text-slate-700">{formatCurrency(row.data.advance_deposit)}</td>
                                        <td className="py-3 pr-4 text-slate-700">
                                            {formatCurrency(row.data.maintenance_charge)} {row.data.maintenance_type?.toLowerCase?.()}
                                        </td>
                                    </tr>
                                ))}
                                {!batchPreview?.preview?.valid?.length && (
                                    <tr>
                                        <td colSpan="5" className="py-8 text-center text-slate-500">
                                            {isLoadingPreview ? 'Checking rows and resolving rent...' : 'No valid rows are ready to import yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        Rent comes from room configuration, not the uploaded file.
                    </p>
                </div>

                {(invalidRows.length > 0 || duplicateRows.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {invalidRows.length > 0 && (
                            <div className="bg-white shadow-lg rounded-2xl border border-rose-100 p-6 flex flex-col h-full">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Rows to fix</h3>
                                    <p className="text-sm text-slate-500 mt-1 mb-4">
                                        Edit the incorrect values and click Revalidate.
                                    </p>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {invalidRows.map((row) => (
                                        <EditableRow 
                                            key={row.row}
                                            row={{ ...row, data: editedRows[row.row] || row.data }} 
                                            errors={row.errors || []} 
                                            onChange={(newData) => handleRowChange(row.row, newData)} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {duplicateRows.length > 0 && (
                            <div className="bg-white shadow-lg rounded-2xl border border-yellow-100 p-6 flex flex-col h-full">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Duplicate rows</h3>
                                    <p className="text-sm text-slate-500 mt-1 mb-4">
                                        These rows conflict with existing tenants. Fix them below.
                                    </p>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {duplicateRows.map((row) => (
                                        <EditableRow 
                                            key={row.row}
                                            row={{ ...row, data: editedRows[row.row] || row.data }} 
                                            errors={[{ field: 'general', message: row.reason || 'Duplicate tenant data found.' }]} 
                                            onChange={(newData) => handleRowChange(row.row, newData)} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
                        disabled={isImporting || isRevalidating}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 px-6 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isImporting || isRevalidating || validation.valid_rows === 0 || validation.invalid_rows > 0 || validation.duplicate_rows > 0}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                            isImporting || isRevalidating || validation.valid_rows === 0 || validation.invalid_rows > 0 || validation.duplicate_rows > 0
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
                        }`}
                    >
                        {isImporting ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>Creating tenants...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                <span>Bulk Invite ({validation.valid_rows} valid rows)</span>
                            </>
                        )}
                    </button>
                </div>
                {(validation.invalid_rows > 0 || validation.duplicate_rows > 0) && (
                    <p className="text-center text-sm text-slate-500 font-medium">
                        You must fix or remove invalid rows before sending bulk invites.
                    </p>
                )}
            </div>
        </div>
    );
}
