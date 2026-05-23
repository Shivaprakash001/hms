export interface PayableObligation {
  id: string;
  amount: number;
  rent_amount?: number;
  maintenance_amount?: number;
  late_fee?: number;
  due_date?: string;
  rent_month?: string;
  label?: string;
  cycle?: string;
  status: string;
}

export function normalizeObligation(raw: Record<string, unknown>): PayableObligation {
  const amount = Number(
    raw.remaining_due ?? raw.outstanding ?? raw.amount ?? 0
  );
  return {
    id: String(raw.id ?? raw.obligation_id ?? ''),
    amount,
    rent_amount: Number(raw.rent_amount ?? raw.amount ?? amount),
    maintenance_amount: Number(raw.maintenance_amount ?? raw.maintenanceAmount ?? 0),
    late_fee: Number(raw.late_fee ?? raw.late_fee_amount ?? 0),
    due_date: raw.due_date as string | undefined,
    rent_month: raw.rent_month as string | undefined,
    label: (raw.installment_label ?? raw.label ?? raw.type) as string | undefined,
    cycle: (raw.rent_month ?? raw.due_date) as string | undefined,
    status: String(raw.status ?? 'pending').toLowerCase(),
  };
}

/** Build payable list from tenant-dues items, then payment history obligations. */
export function buildPayableObligations(
  dues?: { items?: Record<string, unknown>[] } | null,
  payments?: { obligations?: Record<string, unknown>[] } | null
): PayableObligation[] {
  const dueItems = dues?.items ?? [];
  if (dueItems.length > 0) {
    const mapped = dueItems
      .filter((i) => Number(i.outstanding ?? 0) > 0)
      .map((i) =>
        normalizeObligation({
          id: i.obligation_id ?? i.id,
          obligation_id: i.obligation_id,
          outstanding: i.outstanding,
          amount: i.amount,
          rent_amount: i.amount,
          due_date: i.due_date,
          rent_month: i.rent_month,
          installment_label: i.installment_label,
          status: i.status ?? 'pending',
          type: i.type,
        })
      )
      .filter((o) => o.id && o.amount > 0);
    if (mapped.length > 0) return mapped;
  }

  return (payments?.obligations ?? [])
    .map((o) => normalizeObligation(o as Record<string, unknown>))
    .filter((o) => o.id && !['paid', 'waived'].includes(o.status) && o.amount > 0)
    .sort(
      (a, b) =>
        new Date(a.cycle || a.due_date || 0).getTime() -
        new Date(b.cycle || b.due_date || 0).getTime()
    );
}

export function getApiErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: Record<string, unknown> } };
  const data = err?.response?.data;
  if (!data) return 'Unable to complete this action. Please try again.';
  if (data.error && typeof data.error === 'object' && 'message' in data.error) {
    return String((data.error as { message: string }).message);
  }
  if (typeof data.detail === 'object' && data.detail && 'message' in data.detail) {
    return String((data.detail as { message: string }).message);
  }
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.message === 'string') return data.message;
  return 'Unable to complete this action. Please try again.';
}
