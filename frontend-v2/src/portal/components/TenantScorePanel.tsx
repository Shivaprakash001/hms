import { ShieldCheck, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const gradeLabel: Record<string, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  NEEDS_ATTENTION: 'Needs attention',
  HIGH_RISK: 'High risk',
};

const gradeTone: Record<string, string> = {
  EXCELLENT: 'text-emerald-600 bg-emerald-500/10',
  GOOD: 'text-sky-600 bg-sky-500/10',
  FAIR: 'text-amber-600 bg-amber-500/10',
  NEEDS_ATTENTION: 'text-orange-600 bg-orange-500/10',
  HIGH_RISK: 'text-destructive bg-destructive/10',
};

interface ScoreData {
  score?: number;
  grade?: string;
  status?: string;
  trend?: string;
  insights?: string[];
  suggestions?: string[];
}

export function TenantScorePanel({ score }: { score?: ScoreData | null }) {
  if (score?.score == null) return null;

  const grade = String(score.grade ?? 'GOOD');
  const trend = String(score.trend ?? 'STABLE');
  const TrendIcon =
    trend === 'IMPROVING' ? TrendingUp : trend === 'DECLINING' ? TrendingDown : Minus;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Tenant score</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{score.score}/100</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {score.status ?? gradeLabel[grade] ?? 'Good standing'}
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${gradeTone[grade] ?? gradeTone.GOOD}`}
        >
          {gradeLabel[grade] ?? 'Good'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
        <TrendIcon className="w-3.5 h-3.5" />
        {trend === 'IMPROVING' ? 'Improving' : trend === 'DECLINING' ? 'Needs focus' : 'Stable'}
      </div>

      {(score.insights?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1.5">
          {score.insights!.slice(0, 3).map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {(score.suggestions?.length ?? 0) > 0 && grade !== 'EXCELLENT' && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-foreground mb-1">Low score due to</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {score.suggestions!.slice(0, 3).map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
