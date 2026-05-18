export const dAmt = (d) => Number(d?.pending_amount ?? 0);
export const dDays = (d) => Number(d?.days_overdue ?? d?.avg_delay_days ?? 0);
export const dName = (d) => d?.name ?? 'Tenant';
export const dId = (d) => d?.tenant_id ?? d?.id ?? '';

export const riskBadge = (d) => {
  const days = dDays(d);
  const amt = dAmt(d);
  if (days > 15 || amt > 8000) return 'HIGH';
  if (days > 7 || amt > 3000) return 'MEDIUM';
  return 'LOW';
};

export const RISK_CLASSES = {
  HIGH: 'bg-ops-danger/10 text-ops-danger border-ops-danger/20',
  MEDIUM: 'bg-ops-warning/10 text-ops-warning border-ops-warning/20',
  LOW: 'bg-ops-success/10 text-ops-success border-ops-success/20',
};

export const apiErrorCode = (err) =>
  err?.response?.data?.error?.code ?? err?.response?.data?.code;
