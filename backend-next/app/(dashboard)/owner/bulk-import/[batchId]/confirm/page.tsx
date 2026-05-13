"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/providers";

/**
 * Bulk Tenant Import - Confirm & Execute
 * 
 * Shows validation results and allows owner to confirm import
 * of valid rows only.
 */
export default function ConfirmImportPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const batchId = params.batchId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Note: In a real implementation, you'd fetch batch details from an API
  // For now, we'll show a placeholder since we don't have the batch data endpoint
  const [validation, setValidation] = useState({
    total_rows: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    warnings: [] as string[],
  });

  const handleConfirm = async () => {
    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/bulk-import/${batchId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setImportResult(result);
    } catch (err: any) {
      setError(err.message || "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    router.push("/owner/bulk-import");
  };

  // If import completed successfully
  if (importResult) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">Import Successful!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p><strong>{importResult.result?.success_count || 0}</strong> tenants imported successfully.</p>
                {importResult.result?.failure_count > 0 && (
                  <p className="mt-1"><strong>{importResult.result.failure_count}</strong> tenants failed (see details below).</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Security Reminder */}
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">IMPORTANT: Delete Your Excel File</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Now that import is complete, permanently delete the XLSX file you uploaded.</p>
                <p className="mt-1">It contains temporary passwords that should not be stored.</p>
                <div className="mt-2 flex items-center">
                  <input type="checkbox" id="deleted" className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                  <label htmlFor="deleted" className="ml-2 block text-sm text-red-700">
                    I have deleted the Excel file
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Failure Details */}
        {importResult.result?.failures && importResult.result.failures.length > 0 && (
          <div className="bg-white shadow rounded-lg border p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Failed Imports</h3>
            <div className="space-y-2">
              {importResult.result.failures.map((failure: any, idx: number) => (
                <div key={idx} className="bg-red-50 p-3 rounded border border-red-200">
                  <p className="text-sm font-medium text-red-800">Row {failure.row}</p>
                  <p className="text-sm text-red-600">{failure.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/owner/tenants")}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            View Imported Tenants
          </button>
          <button
            onClick={() => router.push("/owner/bulk-import")}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            Import More Tenants
          </button>
        </div>
      </div>
    );
  }

  // Validation preview and confirmation
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Confirm Import</h1>
      <p className="text-gray-600 mb-8">
        Review the validation results before proceeding with the import.
      </p>

      {/* Validation Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Rows</p>
          <p className="text-2xl font-bold">{validation.total_rows}</p>
        </div>
        <div className="bg-green-50 shadow rounded-lg border border-green-200 p-4">
          <p className="text-sm text-green-600">Valid</p>
          <p className="text-2xl font-bold text-green-700">{validation.valid}</p>
        </div>
        <div className="bg-red-50 shadow rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-600">Invalid</p>
          <p className="text-2xl font-bold text-red-700">{validation.invalid}</p>
        </div>
        <div className="bg-yellow-50 shadow rounded-lg border border-yellow-200 p-4">
          <p className="text-sm text-yellow-600">Duplicates</p>
          <p className="text-2xl font-bold text-yellow-700">{validation.duplicates}</p>
        </div>
      </div>

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Warnings</h3>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {validation.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Note about batch data */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Validation details will be loaded from the batch. For now, click "Confirm Import" to proceed with importing valid rows.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleCancel}
          disabled={isImporting}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isImporting || validation.valid === 0}
          className={`flex-1 py-2 px-4 rounded-md text-white ${
            isImporting || validation.valid === 0
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isImporting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Importing...
            </span>
          ) : (
            `Confirm Import (${validation.valid} valid rows)`
          )}
        </button>
      </div>
    </div>
  );
}
