import { Shield, ShieldAlert, AlertTriangle, Clock, MessageSquare, ChevronRight } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` :
  `₹${Math.round(n || 0)}`;

function RiskBadge({ risk }: { risk: string }) {
  const cfg =
    risk === 'critical' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
    risk === 'high' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
    'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return (
    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded capitalize', cfg)}>
      {risk}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-6 text-right text-muted-foreground">{score}</span>
    </div>
  );
}

interface Props {
  intel: any;
}

export function RiskZone({ intel }: Props) {
  const highRisk: any[] = Array.isArray(intel?.dues?.high_risk_tenants) ? intel.dues.high_risk_tenants : [];
  const lowScores: any[] = Array.isArray(intel?.dues?.low_behavior_scores)
    ? intel.dues.low_behavior_scores
    : [];

  if (highRisk.length === 0 && lowScores.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
        <Shield className="h-8 w-8 text-emerald-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-foreground">All Clear</div>
          <div className="text-xs text-muted-foreground">No high-risk tenants or overdue obligations</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" id="risk-zone">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-semibold text-foreground">Risk Zone</h3>
        {highRisk.length > 0 && (
          <span className="ml-auto text-xs bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            {highRisk.length} overdue
          </span>
        )}
      </div>

      {highRisk.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Attention Required
          </div>
          <div className="divide-y divide-border">
            {highRisk.map((t: any, i: number) => (
              <div key={t.tenant_id ?? i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                  {(t.tenant_name ?? t.name ?? 'T').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{t.tenant_name ?? t.name ?? 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{t.room_no ?? 'N/A'}</span>
                    {t.days_overdue > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {t.days_overdue}d overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(t.balance ?? t.outstanding ?? 0)}</div>
                  <RiskBadge risk={t.risk ?? 'medium'} />
                </div>
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Send reminder"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lowScores.length > 0 && (
        <div>
          <div className={cn('px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide', highRisk.length > 0 ? 'border-t border-border' : '')}>
            Habitual Late Payers
          </div>
          <div className="divide-y divide-border">
            {lowScores.map((t: any, i: number) => (
              <div key={t.tenant_id ?? i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                  {(t.tenant_name ?? t.name ?? 'T').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{t.tenant_name ?? t.name ?? 'Unknown'}</div>
                  <ScoreBar score={Number(t.score ?? 50)} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
