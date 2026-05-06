import React from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, ShieldCheck } from 'lucide-react';

const gradeLabel = {
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    FAIR: 'Fair',
    NEEDS_ATTENTION: 'Needs Attention',
    HIGH_RISK: 'High Risk',
};

const gradeTone = {
    EXCELLENT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    GOOD: 'bg-sky-50 text-sky-700 border-sky-100',
    FAIR: 'bg-amber-50 text-amber-700 border-amber-100',
    NEEDS_ATTENTION: 'bg-orange-50 text-orange-700 border-orange-100',
    HIGH_RISK: 'bg-rose-50 text-rose-700 border-rose-100',
};

const trendMeta = {
    IMPROVING: { label: 'Improving', icon: TrendingUp, cls: 'text-emerald-600' },
    STABLE: { label: 'Stable', icon: Minus, cls: 'text-slate-500' },
    DECLINING: { label: 'Needs Focus', icon: TrendingDown, cls: 'text-amber-600' },
};

export default function TenantScoreCard({ scoreData, loading = false, compact = false }) {
    if (loading) {
        return <div className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />;
    }

    if (!scoreData) return null;

    const grade = scoreData.grade || 'GOOD';
    const trend = scoreData.trend || 'STABLE';
    const trendInfo = trendMeta[trend] || trendMeta.STABLE;
    const TrendIcon = trendInfo.icon;

    if (compact) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Tenant Score</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{scoreData.score}/100</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${gradeTone[grade] || gradeTone.GOOD}`}>
                        {gradeLabel[grade] || 'Good'}
                    </div>
                </div>
                <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${trendInfo.cls}`}>
                    <TrendIcon size={14} />
                    {trendInfo.label}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Tenant Score</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{scoreData.score} / 100</h3>
                    <p className="text-sm text-slate-500 mt-1">{scoreData.status || 'Good Standing'}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${gradeTone[grade] || gradeTone.GOOD}`}>
                    {gradeLabel[grade] || 'Good'}
                </div>
            </div>

            <div className={`mt-4 flex items-center gap-1.5 text-sm font-semibold ${trendInfo.cls}`}>
                <TrendIcon size={16} />
                {trendInfo.label} trend
            </div>

            {(scoreData.insights?.length || 0) > 0 && (
                <div className="mt-4 space-y-2">
                    {scoreData.insights.slice(0, 3).map((item, idx) => (
                        <p key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                            <ShieldCheck size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                        </p>
                    ))}
                </div>
            )}

            {(scoreData.suggestions?.length || 0) > 0 && (
                <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Suggestions</p>
                    {scoreData.suggestions.slice(0, 2).map((item, idx) => (
                        <p key={idx} className="text-sm text-slate-700 flex items-start gap-2 mb-1 last:mb-0">
                            <Sparkles size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

