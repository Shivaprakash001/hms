import {
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react';

interface OwnerInsightsProps {
  score?: number | null;
  overdueDays: number;
  outstandingAmount: number;
  depositStatus: string;
  hasAgreement: boolean;
  documentStatus: string;
  joinedDate?: string;
}

export function OwnerInsights({
  score,
  overdueDays,
  outstandingAmount,
  depositStatus,
  hasAgreement,
  documentStatus,
  joinedDate,
}: OwnerInsightsProps) {
  const insights: Array<{
    type: 'critical' | 'warning' | 'success' | 'info';
    message: string;
    icon: any;
  }> = [];

  // 1. Reliability Score insights
  if (score !== undefined && score !== null) {
    if (score < 60) {
      insights.push({
        type: 'critical',
        message: 'High risk of payment default. Prioritize immediate collection.',
        icon: TrendingDown,
      });
    } else if (score >= 85) {
      insights.push({
        type: 'success',
        message: 'Excellent payment reliability. Standard auto-reminders are sufficient.',
        icon: TrendingUp,
      });
    } else if (score < 75) {
      insights.push({
        type: 'warning',
        message: 'Moderate risk. Often pays only after repeated WhatsApp reminders.',
        icon: Info,
      });
    }
  }

  // 2. Overdue insights
  if (overdueDays > 15) {
    insights.push({
      type: 'critical',
      message: `Tenant is ${overdueDays} days overdue. Contact guardian if tenant does not respond.`,
      icon: AlertCircle,
    });
  }

  // 3. Deposit status
  if (depositStatus === 'PENDING') {
    insights.push({
      type: 'warning',
      message: 'Refundable security deposit is unpaid. Restrict room movement.',
      icon: AlertCircle,
    });
  } else if (depositStatus === 'WAIVED') {
    insights.push({
      type: 'info',
      message: 'Security deposit waived by owner. (₹0 deposit arrangement active).',
      icon: CheckCircle2,
    });
  }

  // 4. Agreement status
  if (!hasAgreement) {
    insights.push({
      type: 'warning',
      message: 'Active agreement missing. Urgent signature required to lock room rate.',
      icon: Calendar,
    });
  }

  // 5. Document status
  if (documentStatus === 'MISSING' || documentStatus === 'PENDING') {
    insights.push({
      type: 'warning',
      message: 'Mandatory KYC documentation is missing or unverified.',
      icon: AlertCircle,
    });
  }

  // Fallback default insight
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      message: 'All billing configurations and verification details are in order.',
      icon: CheckCircle2,
    });
  }

  const getColors = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/25 dark:bg-rose-950/20 dark:text-rose-400';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-400';
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:bg-emerald-950/20 dark:text-emerald-400';
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:bg-blue-950/20 dark:text-blue-400';
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-accent animate-pulse" />
        <span>Owner Insights</span>
      </div>

      <div className="flex flex-col gap-2">
        {insights.map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed font-medium transition-all ${getColors(
                insight.type
              )}`}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{insight.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
