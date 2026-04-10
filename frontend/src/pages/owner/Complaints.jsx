import React from 'react';

const Complaints = () => {
    return (
        <div className="space-y-4 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complaints</h1>
                <p className="text-slate-500 text-sm">Owner complaints dashboard is temporarily unavailable.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-600">
                    This page was missing in the current deployment branch and caused build failures on case-sensitive Linux environments.
                    A stable placeholder is now added so routing and deployment work correctly.
                </p>
            </div>
        </div>
    );
};

export default Complaints;
