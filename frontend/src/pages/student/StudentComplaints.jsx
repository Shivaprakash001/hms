import React from 'react';

const StudentComplaints = () => {
    return (
        <div className="space-y-4 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complaints</h1>
                <p className="text-slate-500 text-sm">Tenant complaints module is temporarily unavailable.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-600">
                    This page was missing in the deployment branch and caused build failures on Linux (Vercel) during import resolution.
                    A stable placeholder is now added so routing and builds succeed.
                </p>
            </div>
        </div>
    );
};

export default StudentComplaints;
