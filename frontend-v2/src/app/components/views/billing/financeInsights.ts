export type Tone = 'good' | 'warning' | 'critical' | 'neutral';

export interface UrgencyMeta {
  emoji: string;
  label: string;
  badgeClass: string;
}

export function getUrgencyMeta(daysLate: number): UrgencyMeta {
  if (daysLate > 30) {
    return {
      emoji: '🔴',
      label: `${daysLate} days late`,
      badgeClass: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    };
  }
  if (daysLate > 15) {
    return {
      emoji: '🟠',
      label: `${daysLate} days late`,
      badgeClass: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
    };
  }
  if (daysLate > 7) {
    return {
      emoji: '🟡',
      label: `${daysLate} days late`,
      badgeClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    };
  }
  return {
    emoji: '⚪',
    label: daysLate <= 0 ? 'Due today' : `${daysLate} days late`,
    badgeClass: 'bg-muted text-muted-foreground',
  };
}

export function computeTodaysCollection(payments: Array<Record<string, unknown>>): number {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let total = 0;
  for (const p of payments) {
    const dateStr = (p.payment_date ?? p.paymentDate) as string | undefined;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key === todayKey) {
      total += Number((p.amount_paid ?? p.amount) ?? 0);
    }
  }
  return total;
}

export interface SmartInsight {
  icon: string;
  text: string;
  tone: Tone;
}

export interface PerHostelFinance {
  hostelId: string;
  hostelName: string;
  revenue: number;
  expected_revenue: number;
  pending_dues: number;
}

export interface SmartInsightsInput {
  expectedVal: number;
  collectedVal: number;
  collectionRate: number;
  reminderDependency: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  upcomingCount: number;
  upcomingTotal: number;
  isAllHostels: boolean;
  perHostel: PerHostelFinance[];
  fmtK: (n: number) => string;
}

export function computeSmartInsights(input: SmartInsightsInput): SmartInsight[] {
  const {
    expectedVal,
    collectedVal,
    collectionRate,
    reminderDependency,
    pendingPaymentsCount,
    pendingPaymentsTotal,
    upcomingCount,
    upcomingTotal,
    isAllHostels,
    perHostel,
    fmtK,
  } = input;

  const insights: SmartInsight[] = [];

  // 1. Pace vs target
  if (expectedVal > 0) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pacePct = Math.round((now.getDate() / daysInMonth) * 100);
    const diff = collectionRate - pacePct;
    if (diff <= -5) {
      insights.push({ icon: '💡', text: `Collection is ${Math.abs(diff)}% behind pace this month.`, tone: 'warning' });
    } else if (diff >= 5) {
      insights.push({ icon: '📈', text: `Collection is ${diff}% ahead of pace this month.`, tone: 'good' });
    }
  }

  // 2. Recover-to-milestone
  if (expectedVal > 0 && collectionRate < 100) {
    const milestone = Math.min(100, Math.floor(collectionRate / 5) * 5 + 5);
    const amountNeeded = Math.round((milestone / 100) * expectedVal - collectedVal);
    if (amountNeeded > 0) {
      insights.push({ icon: '⚠', text: `Recover ${fmtK(amountNeeded)} today to reach ${milestone}%.`, tone: 'warning' });
    }
  }

  // 3. Top-dues hostel (all-hostels view only, and only if it's a meaningful share)
  if (isAllHostels && perHostel.length >= 2) {
    const totalOutstanding = perHostel.reduce((sum, h) => sum + h.pending_dues, 0);
    if (totalOutstanding > 0) {
      const top = [...perHostel].sort((a, b) => b.pending_dues - a.pending_dues)[0];
      const share = Math.round((top.pending_dues / totalOutstanding) * 100);
      if (share >= 25) {
        insights.push({ icon: '💰', text: `${top.hostelName} contributes ${share}% of all dues.`, tone: 'neutral' });
      }
    }
  }

  // 4. Reminder dependency (folded from the old Revenue Health grid)
  if (reminderDependency > 0) {
    insights.push({
      icon: '🔔',
      text: `${reminderDependency}% of tenants needed a reminder to pay this cycle.`,
      tone: reminderDependency > 50 ? 'warning' : 'neutral',
    });
  }

  // 5. Unconfirmed payments (folded from the dropped card)
  if (pendingPaymentsCount > 0) {
    insights.push({
      icon: '🧾',
      text: `${pendingPaymentsCount} payment proof${pendingPaymentsCount === 1 ? '' : 's'} awaiting review (${fmtK(pendingPaymentsTotal)}).`,
      tone: 'warning',
    });
  }

  // 6. Due this week (folded from the dropped card)
  if (upcomingCount > 0) {
    insights.push({
      icon: '📅',
      text: `${fmtK(upcomingTotal)} due this week from ${upcomingCount} tenant${upcomingCount === 1 ? '' : 's'}.`,
      tone: 'neutral',
    });
  }

  if (insights.length === 0) {
    return [{ icon: '✓', text: 'All caught up — no overdue collections or pending items.', tone: 'good' }];
  }

  return insights.slice(0, 4);
}

export interface PropertyFinanceCard extends PerHostelFinance {
  collectionRate: number;
  pending: number;
  tone: Tone;
  medal: string;
}

export function computePropertyFinance(perHostel: PerHostelFinance[]): PropertyFinanceCard[] {
  return perHostel
    .map((h) => {
      const collectionRate = h.expected_revenue > 0 ? Math.round((h.revenue / h.expected_revenue) * 100) : 0;
      const tone: Tone = collectionRate >= 80 ? 'good' : collectionRate >= 50 ? 'warning' : 'critical';
      const medal = tone === 'good' ? '🥇' : tone === 'warning' ? '🟡' : '🔴';
      return {
        ...h,
        collectionRate,
        pending: h.pending_dues,
        tone,
        medal,
      };
    })
    .sort((a, b) => b.collectionRate - a.collectionRate);
}
