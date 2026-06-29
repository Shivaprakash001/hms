import { ShieldCheck, ShieldAlert, Shield, Loader2, FileCheck2, UserCheck, AlertTriangle } from 'lucide-react';

interface TenantHealthCardProps {
  score?: number | null;
  grade?: string;
  trend?: string;
  hasAgreement: boolean;
  documentStatus: string;
  loading?: boolean;
}

export function TenantHealthCard({
  score = 80,
  grade = 'GOOD',
  trend = 'STABLE',
  hasAgreement,
  documentStatus,
  loading = false,
}: TenantHealthCardProps) {
  if (loading) {
    return (
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  // Calculate composite health score if not provided
  const baseScore = score ?? 75;
  let compositeScore = baseScore;
  
  // Deduct for missing agreement
  if (!hasAgreement) compositeScore -= 15;
  // Deduct for missing documents
  if (documentStatus === 'MISSING') compositeScore -= 15;
  else if (documentStatus === 'PENDING') compositeScore -= 5;
  
  compositeScore = Math.max(10, Math.min(100, compositeScore));

  // Determine health level
  let healthLevel: 'Excellent' | 'Good' | 'Risk' | 'Critical' = 'Good';
  let healthColor = 'text-emerald-500';
  let healthBg = 'bg-emerald-500/10 border-emerald-500/20';
  let healthText = 'Payer reliability is high, all core configurations verified.';

  if (compositeScore >= 90) {
    healthLevel = 'Excellent';
    healthColor = 'text-emerald-600 dark:text-emerald-400';
    healthBg = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400';
  } else if (compositeScore >= 70) {
    healthLevel = 'Good';
    healthColor = 'text-blue-600 dark:text-blue-400';
    healthBg = 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-950/20 dark:text-blue-400';
    healthText = 'Minor document or verification checklist pending.';
  } else if (compositeScore >= 45) {
    healthLevel = 'Risk';
    healthColor = 'text-amber-600 dark:text-amber-400';
    healthBg = 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-400';
    healthText = 'Elevated default or non-compliance risk. Active follow-up needed.';
  } else {
    healthLevel = 'Critical';
    healthColor = 'text-rose-600 dark:text-rose-400';
    healthBg = 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-950/20 dark:text-rose-400';
    healthText = 'Critical status. Highly delayed payments or major agreement issues.';
  }

  return (
    <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${healthBg}`}>
            {healthLevel === 'Excellent' || healthLevel === 'Good' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Composite Tenant Health
            </p>
            <p className="text-lg font-black text-foreground leading-tight">
              {compositeScore}
              <span className="text-xs font-semibold text-muted-foreground">/100</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${healthBg}`}>
            {healthLevel}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {healthText}
      </p>

      {/* Composite checklist details */}
      <div className="grid grid-cols-3 gap-2.5 pt-2.5 border-t border-border/60 text-[10px]">
        {/* Payment Health */}
        <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-secondary/50 border border-border/50 text-center">
          <UserCheck className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Payment Rate</span>
          <span className="text-muted-foreground font-medium">{baseScore}%</span>
        </div>

        {/* Agreement Status */}
        <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-secondary/50 border border-border/50 text-center">
          <FileCheck2 className={`w-4 h-4 ${hasAgreement ? 'text-emerald-500' : 'text-rose-500'}`} />
          <span className="font-semibold text-foreground">Agreement</span>
          <span className="text-muted-foreground font-medium">{hasAgreement ? 'Signed' : 'Missing'}</span>
        </div>

        {/* Documents Verification */}
        <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-secondary/50 border border-border/50 text-center">
          <AlertTriangle className={`w-4 h-4 ${documentStatus === 'VERIFIED' ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="font-semibold text-foreground">KYC Verification</span>
          <span className="text-muted-foreground font-medium">
            {documentStatus === 'VERIFIED' ? 'Verified' : documentStatus === 'PENDING' ? 'Pending' : 'Missing'}
          </span>
        </div>
      </div>
    </div>
  );
}
