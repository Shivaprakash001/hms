import React from 'react';
import { RefreshCw } from 'lucide-react';

export const LoadingSpinner = ({ size = 24, text = 'Loading...', fullScreen = false }) => {
    const content = (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 animate-pulse shadow-xl shadow-indigo-50">
                <RefreshCw size={size} className="animate-spin" />
            </div>
            {text && <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{text}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                {content}
            </div>
        );
    }

    return content;
};
