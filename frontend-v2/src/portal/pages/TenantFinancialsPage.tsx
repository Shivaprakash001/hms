import { useEffect, useMemo, useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CalendarDays, 
  CreditCard, 
  Download, 
  Loader2, 
  Send, 
  WalletCards, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { tenantPortalApi } from '@features/tenant-portal/api';
import { TenantReservationCard } from '@/platforms/tenant/components/TenantReservationCard';
import { TenantPaymentModal } from '@/portal/components/TenantPaymentModal';
import { TenantPaymentDetailModal } from '@/domains/payments/components/TenantPaymentDetailModal';
import { buildPayableObligations } from '@/portal/utils/payableObligations';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const timelineAmount = (item: any) => {
  if (item.type === 'PAYMENT' || item.type === 'ADVANCE_CREDIT') return Number(item.amount ?? 0);
  return Number(item.remaining ?? item.amount ?? 0);
};
const canSelectTimelineItem = (item: any) => item.state === 'upcoming' && timelineAmount(item) > 0;

interface FinancialState {
  selectedIds: string[];
  selectedProjectedIds: string[];
  showPayModal: boolean;
  showAdvancePayModal: boolean;
  selectedPaymentForDetail: any | null;
  requestedFrequency: string;
  requestReason: string;
  historyExpanded: boolean;
}

const initialFinancialState: FinancialState = {
  selectedIds: [],
  selectedProjectedIds: [],
  showPayModal: false,
  showAdvancePayModal: false,
  selectedPaymentForDetail: null,
  requestedFrequency: 'QUARTERLY',
  requestReason: '',
  historyExpanded: false,
};

type FinancialAction =
  | { type: 'SET_SELECTED_IDS'; payload: string[] }
  | { type: 'SET_SELECTED_PROJECTED_IDS'; payload: string[] }
  | { type: 'SYNC_PAYABLE_ITEMS'; payload: any[] }
  | { type: 'SYNC_TIMELINE_ITEMS'; payload: any[] }
  | { type: 'SET_SHOW_PAY_MODAL'; payload: boolean }
  | { type: 'SET_SHOW_ADVANCE_PAY_MODAL'; payload: boolean }
  | { type: 'SET_SELECTED_PAYMENT_FOR_DETAIL'; payload: any }
  | { type: 'SET_REQUESTED_FREQUENCY'; payload: string }
  | { type: 'SET_REQUEST_REASON'; payload: string }
  | { type: 'SET_HISTORY_EXPANDED'; payload: boolean }
  | { type: 'PREPAY_INSTALLMENT'; payload: { id: string } }
  | { type: 'PAY_CURRENT_INSTALLMENT'; payload: { ids: string[] } }
  | { type: 'RECORD_PAYMENT_SUCCESS' }
  | { type: 'RECORD_ADVANCE_SUCCESS' }
  | { type: 'TRIGGER_DIRECT_PAYMENT'; payload: string[] };

function financialReducer(state: FinancialState, action: FinancialAction): FinancialState {
  switch (action.type) {
    case 'SET_SELECTED_IDS':
      return { ...state, selectedIds: action.payload };
    case 'SET_SELECTED_PROJECTED_IDS':
      return { ...state, selectedProjectedIds: action.payload };
    case 'SYNC_PAYABLE_ITEMS': {
      const filtered = state.selectedIds.filter((id) => action.payload.some((p) => p.id === id));
      const hasChanged = filtered.length !== state.selectedIds.length || !filtered.every((val, idx) => val === state.selectedIds[idx]);
      return hasChanged ? { ...state, selectedIds: filtered } : state;
    }
    case 'SYNC_TIMELINE_ITEMS': {
      const filtered = state.selectedProjectedIds.filter((id) =>
        action.payload.some((item) => item.timeline_id === id && canSelectTimelineItem(item))
      );
      const hasChanged = filtered.length !== state.selectedProjectedIds.length || !filtered.every((val, idx) => val === state.selectedProjectedIds[idx]);
      return hasChanged ? { ...state, selectedProjectedIds: filtered } : state;
    }
    case 'SET_SHOW_PAY_MODAL':
      return { ...state, showPayModal: action.payload };
    case 'SET_SHOW_ADVANCE_PAY_MODAL':
      return { ...state, showAdvancePayModal: action.payload };
    case 'SET_SELECTED_PAYMENT_FOR_DETAIL':
      return { ...state, selectedPaymentForDetail: action.payload };
    case 'SET_REQUESTED_FREQUENCY':
      return { ...state, requestedFrequency: action.payload };
    case 'SET_REQUEST_REASON':
      return { ...state, requestReason: action.payload };
    case 'SET_HISTORY_EXPANDED':
      return { ...state, historyExpanded: action.payload };
    case 'PREPAY_INSTALLMENT':
      return {
        ...state,
        selectedProjectedIds: [action.payload.id],
        showAdvancePayModal: true,
      };
    case 'PAY_CURRENT_INSTALLMENT':
      return {
        ...state,
        selectedIds: action.payload.ids,
        showPayModal: true,
      };
    case 'RECORD_PAYMENT_SUCCESS':
      return {
        ...state,
        showPayModal: false,
        selectedIds: [],
      };
    case 'RECORD_ADVANCE_SUCCESS':
      return {
        ...state,
        showAdvancePayModal: false,
        selectedProjectedIds: [],
      };
    case 'TRIGGER_DIRECT_PAYMENT':
      return {
        ...state,
        selectedIds: action.payload,
        showPayModal: true,
      };
    default:
      return state;
  }
}

export function TenantFinancialsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, dues, payments, advance, isLoading } = useTenantDashboard();
  const resStatus = profile?.reservation_status?.status ?? 'PAYMENT_PENDING';
  
  const [state, dispatch] = useReducer(financialReducer, initialFinancialState);

  const billingContext = useQuery({
    queryKey: ['tenant', 'billing-frequency'],
    queryFn: () => tenantPortalApi.getMyBillingFrequency(),
  });
  
  const billingTimeline = useQuery({
    queryKey: ['tenant', 'billing-timeline'],
    queryFn: () => tenantPortalApi.getMyBillingTimeline(),
  });
  
  const timelineItems = useMemo(() => billingTimeline.data?.items ?? [], [billingTimeline.data?.items]);

  const frequencyMutation = useMutation({
    mutationFn: () => tenantPortalApi.requestBillingFrequencyChange({
      requested_frequency: state.requestedFrequency,
      reason: state.requestReason,
    }),
    onSuccess: () => {
      toast.success('Billing change request sent to owner');
      dispatch({ type: 'SET_REQUEST_REASON', payload: '' });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'billing-frequency'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not submit request');
    },
  });

  // Re-build payable obligations for standard dues breakdown
  const payableItems = useMemo(
    () => buildPayableObligations(dues, payments),
    [dues, payments]
  );

  useEffect(() => {
    dispatch({ type: 'SYNC_PAYABLE_ITEMS', payload: payableItems });
  }, [payableItems]);

  useEffect(() => {
    dispatch({ type: 'SYNC_TIMELINE_ITEMS', payload: timelineItems });
  }, [timelineItems]);

  const selectedProjectedItems = useMemo(
    () => timelineItems.filter((item: any) => state.selectedProjectedIds.includes(item.timeline_id) && canSelectTimelineItem(item)),
    [timelineItems, state.selectedProjectedIds]
  );

  const selectedProjectedTotal = useMemo(
    () => selectedProjectedItems.reduce((s: number, item: any) => s + timelineAmount(item), 0),
    [selectedProjectedItems]
  );

  const advancePaymentContext = useMemo(() => {
    return selectedProjectedItems.map((item: any) => ({
      id: item.timeline_id,
      amount: timelineAmount(item),
      label: item.label,
      due_date: item.due_date,
      cycle: item.period_start || item.rent_month,
    }));
  }, [selectedProjectedItems]);

  // Handle direct payment trigger (e.g. from priority strip link / dashboard checkout)
  useEffect(() => {
    if (searchParams.get('pay') === '1' && payableItems.length > 0) {
      dispatch({ type: 'TRIGGER_DIRECT_PAYMENT', payload: payableItems.map((p) => p.id) });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, payableItems, setSearchParams]);

  const selectedItems = useMemo(
    () => payableItems.filter((p) => state.selectedIds.includes(p.id)),
    [payableItems, state.selectedIds]
  );
  
  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, p) => s + p.amount, 0),
    [selectedItems]
  );

  // Group obligations underneath installments (Installment ViewModel)
  const installments = useMemo(() => {
    if (!timelineItems || timelineItems.length === 0) return [];

    const installmentsMap: Record<string, any> = {};

    timelineItems.forEach((item: any) => {
      // Exclude transaction records (payments & credits) from being treated as installments themselves
      if (['PAYMENT', 'ADVANCE_CREDIT'].includes(item.type)) {
        return;
      }

      // Group by period start date
      const periodStart = item.period_start || item.rent_month;
      if (!periodStart) return;
      
      const dateKey = new Date(periodStart).toISOString().slice(0, 10);

      if (!installmentsMap[dateKey]) {
        installmentsMap[dateKey] = {
          id: item.obligation_id || item.timeline_id,
          timeline_id: item.timeline_id,
          period_start: item.period_start || item.rent_month,
          period_end: item.period_end || item.rent_month,
          rent_month: item.rent_month,
          // Strip maintenance suffix from label if present to keep the installment cycle label clean
          label: item.label ? String(item.label).replace(/ maintenance/gi, '') : '',
          due_date: item.due_date,
          rent_amount: 0,
          maintenance_amount: 0,
          late_fee_amount: 0,
          paid: 0,
          remaining: 0,
          covered_by_advance: 0,
          status: item.status,
          state: item.state,
          obligations: [],
        };
      }

      const inst = installmentsMap[dateKey];
      inst.obligations.push(item);

      // Prefer the rent item's details for the main installment info
      if (item.type === 'RENT' || item.type === 'PROJECTED_RENT') {
        inst.id = item.obligation_id || item.timeline_id;
        inst.label = item.label;
        inst.due_date = item.due_date;
      }

      // Add component amounts
      if (item.type === 'RENT' || item.type === 'PROJECTED_RENT') {
        inst.rent_amount += Number(item.amount ?? 0);
      } else if (item.type === 'MAINTENANCE' || item.type === 'PROJECTED_MAINTENANCE') {
        inst.maintenance_amount += Number(item.amount ?? 0);
      } else if (item.type === 'LATE_FEE') {
        inst.late_fee_amount += Number(item.amount ?? 0);
      }

      // Accumulate totals
      inst.paid += Number(item.paid ?? 0);
      inst.remaining += Number(item.remaining ?? 0);
      inst.covered_by_advance += Number(item.covered_by_advance ?? 0);
    });

    // Merge actual dues (unpaid obligations) data from dues.items for accuracy, especially late fees
    Object.values(installmentsMap).forEach((inst: any) => {
      inst.obligations.forEach((timelineOb: any) => {
        if (timelineOb.obligation_id) {
          const dueItem = dues?.items?.find((d: any) => d.obligation_id === timelineOb.obligation_id);
          if (dueItem) {
            timelineOb.amount = dueItem.amount;
            timelineOb.paid = dueItem.paid;
            timelineOb.remaining = dueItem.outstanding;
            timelineOb.status = dueItem.status;
          }
        }
      });

      // Recalculate sums
      inst.rent_amount = 0;
      inst.maintenance_amount = 0;
      inst.late_fee_amount = 0;
      inst.paid = 0;
      inst.remaining = 0;
      inst.covered_by_advance = 0;

      inst.obligations.forEach((ob: any) => {
        if (ob.type === 'RENT' || ob.type === 'PROJECTED_RENT') {
          inst.rent_amount += Number(ob.amount ?? 0);
        } else if (ob.type === 'MAINTENANCE' || ob.type === 'PROJECTED_MAINTENANCE') {
          inst.maintenance_amount += Number(ob.amount ?? 0);
        } else if (ob.type === 'LATE_FEE') {
          inst.late_fee_amount += Number(ob.amount ?? 0);
        }
        inst.paid += Number(ob.paid ?? 0);
        inst.remaining += Number(ob.remaining ?? 0);
        inst.covered_by_advance += Number(ob.covered_by_advance ?? 0);
      });

      inst.total_amount = inst.rent_amount + inst.maintenance_amount + inst.late_fee_amount;

      // Determine aggregated status & state
      const allWaived = inst.obligations.every((o: any) => o.status === 'WAIVED');
      const allProjected = inst.obligations.every((o: any) => o.status === 'PROJECTED');

      if (allWaived) {
        inst.status = 'WAIVED';
        inst.state = 'waived';
      } else if (allProjected) {
        inst.status = 'PROJECTED';
        inst.state = inst.remaining <= 0 ? 'covered' : 'upcoming';
      } else if (inst.remaining <= 0) {
        inst.status = 'PAID';
        inst.state = 'paid';
      } else {
        inst.status = inst.paid > 0 ? 'PARTIAL' : 'PENDING';
        
        // Calculate state based on due date
        const dueDate = new Date(inst.due_date);
        const today = new Date();
        today.setHours(0,0,0,0);
        dueDate.setHours(0,0,0,0);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          inst.state = 'overdue';
        } else if (diffDays <= 5) {
          inst.state = 'due_soon';
        } else {
          inst.state = 'pending';
        }
      }
    });

    // Sort chronologically
    const sorted = Object.values(installmentsMap).sort((a: any, b: any) => {
      return new Date(a.period_start).getTime() - new Date(b.period_start).getTime();
    });

    // Find current installment (today falls between period_start and period_end)
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let current = sorted.find((inst: any) => {
      const start = new Date(inst.period_start);
      const end = new Date(inst.period_end);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return today >= start && today <= end;
    });

    // Fallback if none matches the exact current period:
    // Either the first unpaid/pending cycle, or the latest past cycle
    if (!current && sorted.length > 0) {
      current = sorted.find((inst: any) => inst.status !== 'PAID' && inst.status !== 'PROJECTED') 
        || sorted[sorted.length - 1];
    }

    sorted.forEach((inst: any) => {
      inst.isCurrent = current && inst.period_start === current.period_start;
    });

    return sorted;
  }, [timelineItems, dues]);

  const currentInstallment = useMemo(() => installments.find((inst) => inst.isCurrent), [installments]);

  // Financial Health Card State Resolution
  const financialHealth = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Red State: Overdue installment exists
    const overdueList = installments.filter(inst => inst.state === 'overdue');
    if (overdueList.length > 0) {
      const totalOverdueAmount = overdueList.reduce((s, inst) => s + inst.remaining, 0);
      
      // Calculate max days overdue
      const earliestDueDate = overdueList.reduce((earliest, inst) => {
        const d = new Date(inst.due_date);
        return d < earliest ? d : earliest;
      }, new Date());
      
      const diffTime = today.getTime() - earliestDueDate.getTime();
      const daysOverdue = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      return {
        state: 'RED',
        title: 'Payment Overdue',
        amountLabel: 'Amount Overdue',
        amount: totalOverdueAmount,
        subtext: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}. Immediate action required.`,
        bgClass: 'bg-gradient-to-br from-red-600 via-red-500 to-rose-700 text-white shadow-lg shadow-red-500/20',
        icon: ShieldAlert,
      };
    }

    // 2. Orange State: Payment due soon (within 5 days)
    const dueSoonList = installments.filter(inst => inst.state === 'due_soon');
    if (dueSoonList.length > 0) {
      const totalDueSoonAmount = dueSoonList.reduce((s, inst) => s + inst.remaining, 0);
      const earliestDueSoonDate = dueSoonList.reduce((earliest, inst) => {
        const d = new Date(inst.due_date);
        return d < earliest ? d : earliest;
      }, new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000));

      const diffTime = earliestDueSoonDate.getTime() - today.getTime();
      const daysDue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      return {
        state: 'ORANGE',
        title: 'Payment Due Soon',
        amountLabel: 'Amount Due',
        amount: totalDueSoonAmount,
        subtext: daysDue === 0 ? 'Due today. Please complete your payment.' : `Due in ${daysDue} day${daysDue === 1 ? '' : 's'}.`,
        bgClass: 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20',
        icon: Clock,
      };
    }

    // 3. Green State: All Clear
    // Next upcoming installment
    const upcomingList = installments.filter(inst => inst.status === 'PROJECTED' || inst.status === 'PENDING');
    const nextInstallment = upcomingList[0];
    let nextInstallmentText = 'No upcoming installments';
    
    if (nextInstallment) {
      const diffTime = new Date(nextInstallment.due_date).getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      nextInstallmentText = `Next Installment: ${fmt(nextInstallment.total_amount)} Due: ${fmtDate(nextInstallment.due_date)} (${daysRemaining} days remaining)`;
    }

    return {
      state: 'GREEN',
      title: 'All Payments Up to Date',
      amountLabel: 'Balance Due',
      amount: 0,
      subtext: nextInstallmentText,
      bgClass: 'bg-gradient-to-br from-[#1B2D5B] via-[#243A72] to-[#059669] text-white shadow-lg shadow-blue-900/20',
      icon: ShieldCheck,
    };
  }, [installments]);

  // Financial Forecast Section
  const forecastInstallments = useMemo(() => {
    // Get the first two upcoming/projected cycles
    return installments
      .filter((inst) => inst.status === 'PROJECTED' || (inst.status === 'PENDING' && !inst.isCurrent))
      .slice(0, 2);
  }, [installments]);

  // Payment History mapping
  const obligations = (payments?.obligations ?? []) as Record<string, unknown>[];
  const paymentList = (payments?.payments ?? payments?.history ?? []) as Record<string, unknown>[];
  
  const advanceCreditHistory = useMemo(() => {
    return ((advance as any)?.entries ?? [])
      .filter((entry: any) => entry?.type === 'CREDIT' && entry?.reason === 'TOPUP')
      .map((entry: any) => ({
        id: `advance-${entry.id}`,
        label: 'Future rent credit',
        amount: Number(entry.amount ?? 0),
        date: String(entry.created_at ?? ''),
        method: entry.reference_type === 'PAYMENT_ATTEMPT' ? 'PHONEPE' : 'Future rent credit',
        receipt_payment_id: `advance-${entry.id}`,
        reference_number: String(entry.reference_id || ''),
        rent_month: '',
      }));
  }, [advance]);

  const allPayments = useMemo(() => {
    return [
      ...paymentList.map((p) => ({
        id: String(p.id),
        label: 'Payment received',
        amount: Number(p.amount_paid ?? p.amount ?? 0),
        date: String(p.payment_date ?? p.created_at ?? ''),
        method: String(p.payment_method ?? p.method ?? 'Payment'),
        receipt_payment_id: p.id ? String(p.id) : null,
        reference_number: String(p.reference_number || p.transaction_id || ''),
        rent_month: String(p.rent_month || ''),
      })),
      ...advanceCreditHistory,
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [paymentList, advanceCreditHistory]);

  const recentPayments = useMemo(() => {
    return state.historyExpanded ? allPayments : allPayments.slice(0, 2);
  }, [allPayments, state.historyExpanded]);

  const totalDue = Number(dues?.total_due ?? payments?.outstanding_balance ?? 0);
  const allowedFrequencies = (billingContext.data?.allowed_frequencies ?? ['MONTHLY', 'QUARTERLY'])
    .filter((f: string) => f !== billingContext.data?.active_frequency && f !== 'CUSTOM_INSTALLMENTS');
  
  const pendingFrequencyRequest = (billingContext.data?.requests ?? []).find((r: any) => r.status === 'PENDING');

  // Interactive prepayment handler
  const handlePrepay = (inst: any) => {
    dispatch({ type: 'PREPAY_INSTALLMENT', payload: { id: inst.timeline_id } });
  };

  const handlePayCurrentInstallment = () => {
    if (!currentInstallment) return;
    
    // Find all outstanding obligations matching this installment
    const unpaidObs = currentInstallment.obligations.filter((o: any) => o.remaining > 0);
    if (unpaidObs.length === 0) return;

    const ids = unpaidObs.map((o: any) => o.obligation_id);
    dispatch({ type: 'PAY_CURRENT_INSTALLMENT', payload: { ids } });
  };

  const handlePaymentSuccess = () => {
    dispatch({ type: 'RECORD_PAYMENT_SUCCESS' });
    queryClient.invalidateQueries({ queryKey: ['tenant'] });
    toast.success('Payment recorded successfully');
  };

  const handleReceipt = async (paymentId: string) => {
    try {
      const blob = await tenantPortalApi.downloadReceipt(paymentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${paymentId.slice(0, 8)}.pdf`;
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 250);
      toast.success('Receipt downloaded');
    } catch {
      toast.error('Could not download receipt');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const HealthIcon = financialHealth.icon;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Money Screen</h1>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>Sri Adithya Hostels</span>
        </div>
      </div>

      {/* SECTION 1 – FINANCIAL HEALTH HERO CARD */}
      <div className={`rounded-2xl p-6 ${financialHealth.bgClass} flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all duration-300`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider font-semibold opacity-75">Financial Status</span>
            <h2 className="text-2xl font-extrabold tracking-tight">{financialHealth.title}</h2>
          </div>
          <HealthIcon className="w-10 h-10 opacity-90 p-1.5 bg-white/10 rounded-xl backdrop-blur-md" />
        </div>
        <div className="mt-4 pt-4 border-t border-white/15">
          {financialHealth.state !== 'GREEN' && (
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-sm font-semibold opacity-85">{financialHealth.amountLabel}:</span>
              <span className="text-2xl font-black">{fmt(financialHealth.amount)}</span>
            </div>
          )}
          <p className="text-sm font-medium opacity-90 flex items-center gap-1.5">
            {financialHealth.subtext}
          </p>
        </div>
      </div>

      {/* RESERVATION CARD (IF APPLICABLE) */}
      {resStatus === 'PAYMENT_PENDING' && profile?.reservation_status && (
        <TenantReservationCard reservationStatus={profile.reservation_status} />
      )}

      {/* SECTION 2 – BILLING CONTRACT SUMMARY */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <WalletCards className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Billing Contract</h2>
            <p className="text-xs text-muted-foreground">Active lease agreement</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground block font-medium">Billing Plan</span>
            <span className="font-bold text-foreground">
              {String(billingContext.data?.active_frequency ?? 'MONTHLY').replaceAll('_', ' ')}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground block font-medium">Monthly Rent</span>
            <span className="font-bold text-foreground">
              {fmt(Number(profile?.monthly_rent ?? 0))}
            </span>
          </div>
          <div className="space-y-0.5 col-span-2">
            <span className="text-xs text-muted-foreground block font-medium">Current Billing Cycle</span>
            <span className="font-medium text-foreground">
              {currentInstallment 
                ? `${fmtDate(currentInstallment.period_start)} to ${fmtDate(currentInstallment.period_end)}` 
                : 'No active billing cycle'}
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 3 – CURRENT INSTALLMENT */}
      {currentInstallment && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">Current Installment</span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{currentInstallment.label}</h3>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              currentInstallment.status === 'PAID' 
                ? 'bg-emerald-100 text-emerald-800' 
                : currentInstallment.status === 'PARTIAL' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {currentInstallment.status}
            </span>
          </div>

          <div className="space-y-2 text-sm pt-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Rent Portion</span>
              <span className="font-medium text-foreground">{fmt(currentInstallment.rent_amount)}</span>
            </div>
            {currentInstallment.maintenance_amount > 0 && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Maintenance Fee</span>
                <span className="font-medium text-foreground">{fmt(currentInstallment.maintenance_amount)}</span>
              </div>
            )}
            {currentInstallment.late_fee_amount > 0 && (
              <div className="flex justify-between items-center text-red-600 font-medium">
                <span>Late Fees Accrued</span>
                <span>{fmt(currentInstallment.late_fee_amount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-border font-bold text-base text-foreground">
              <span>Total Installment</span>
              <span>{fmt(currentInstallment.total_amount)}</span>
            </div>
            {currentInstallment.paid > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold text-sm">
                <span>Paid So Far</span>
                <span>-{fmt(currentInstallment.paid)}</span>
              </div>
            )}
            {currentInstallment.covered_by_advance > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold text-sm">
                <span>Credit Applied</span>
                <span>-{fmt(currentInstallment.covered_by_advance)}</span>
              </div>
            )}
            {currentInstallment.remaining > 0 && (
              <div className="flex justify-between items-center pt-1 text-accent font-extrabold text-lg">
                <span>Remaining Due</span>
                <span>{fmt(currentInstallment.remaining)}</span>
              </div>
            )}
          </div>

          {currentInstallment.remaining > 0 && (
            <button
              type="button"
              onClick={handlePayCurrentInstallment}
              className="mt-4 flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-accent text-accent-foreground font-bold text-sm shadow-md shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Pay Current Installment ({fmt(currentInstallment.remaining)})
            </button>
          )}
        </section>
      )}

      {/* SECTION 4 – UPCOMING FINANCIAL FORECAST */}
      {forecastInstallments.length > 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-card/40 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Financial Forecast</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {forecastInstallments.map((inst, index) => (
              <div key={inst.period_start} className="flex justify-between items-center bg-card p-3 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground font-medium block">
                    {index === 0 ? 'Next Installment' : 'Following Installment'}
                  </span>
                  <span className="text-sm font-bold text-foreground">{inst.label}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-sm font-bold text-accent block">{fmt(inst.total_amount)}</span>
                  <span className="text-xs text-muted-foreground block font-medium">Due {fmtDate(inst.due_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 5 – INSTALLMENT TIMELINE */}
      {installments.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Installment Timeline</h2>
          </div>

          <div className="relative border-l border-border pl-6 ml-2 space-y-8">
            {installments.map((inst) => {
              // Determine status indicator node
              let nodeContent = (
                <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border border-card" />
              );
              
              if (inst.state === 'paid' || inst.state === 'covered') {
                nodeContent = (
                  <div className="absolute left-[-11px] top-0 w-[22px] h-[22px] rounded-full bg-emerald-500 text-white flex items-center justify-center border-4 border-card shadow-sm shadow-emerald-500/10">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                );
              } else if (inst.isCurrent) {
                nodeContent = (
                  <div className="absolute left-[-11px] top-0 w-[22px] h-[22px] rounded-full bg-accent text-accent-foreground flex items-center justify-center border-4 border-card shadow-sm shadow-accent/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-foreground"></span>
                    </span>
                  </div>
                );
              } else if (inst.state === 'overdue') {
                nodeContent = (
                  <div className="absolute left-[-11px] top-0 w-[22px] h-[22px] rounded-full bg-red-500 text-white flex items-center justify-center border-4 border-card shadow-sm shadow-red-500/10">
                    <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                  </div>
                );
              }

              return (
                <div key={inst.period_start} className="relative group">
                  {nodeContent}
                  
                  <div className={`p-4 rounded-xl border transition-all duration-200 ${
                    inst.isCurrent 
                      ? 'border-accent bg-accent/5 ring-1 ring-accent shadow-sm' 
                      : inst.state === 'paid' || inst.state === 'covered'
                      ? 'border-emerald-100 bg-emerald-50/20'
                      : 'border-border bg-card'
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground">{inst.label}</h4>
                          {inst.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-extrabold uppercase tracking-wide">
                              Current Cycle
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {inst.status === 'PROJECTED' ? 'Forecasted' : inst.status === 'PAID' ? 'Fully Paid' : `Due ${fmtDate(inst.due_date)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-foreground">{fmt(inst.total_amount)}</span>
                        {inst.covered_by_advance > 0 && (
                          <span className="text-[10px] text-emerald-600 block font-semibold mt-0.5">
                            {fmt(inst.covered_by_advance)} credit applied
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand breakdown details for current or overdue/partially paid installments */}
                    {(inst.isCurrent || inst.state === 'overdue' || (inst.paid > 0 && inst.remaining > 0)) && (
                      <div className="mt-3 pt-3 border-t border-dashed border-border/80 text-[11px] space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Rent:</span>
                          <span className="font-medium text-foreground">{fmt(inst.rent_amount)}</span>
                        </div>
                        {inst.maintenance_amount > 0 && (
                          <div className="flex justify-between">
                            <span>Maintenance:</span>
                            <span className="font-medium text-foreground">{fmt(inst.maintenance_amount)}</span>
                          </div>
                        )}
                        {inst.late_fee_amount > 0 && (
                          <div className="flex justify-between text-red-500 font-semibold">
                            <span>Late Fees:</span>
                            <span>{fmt(inst.late_fee_amount)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prepayment Action Button (Clean prepay UX without checkboxes) */}
                    {inst.status === 'PROJECTED' && inst.remaining > 0 && (
                      <div className="mt-3 pt-2 border-t border-border flex justify-end">
                        <button
                          type="button"
                          onClick={() => handlePrepay(inst)}
                          className="px-3.5 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Prepay Installment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 6 – BILLING CONTRACT CHANGE REQUEST / STATUS */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground font-bold">Contract Change Request</h2>
            <p className="text-xs text-muted-foreground">Request plan upgrade or downgrade</p>
          </div>
        </div>

        {pendingFrequencyRequest ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-4 text-amber-900 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-800/80">Active Request Status</h3>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <span className="block text-amber-800/80 font-medium">Current Plan</span>
                <span className="font-bold text-sm">{String(billingContext.data?.active_frequency ?? 'MONTHLY').replaceAll('_', ' ')}</span>
              </div>
              <div>
                <span className="block text-amber-800/80 font-medium">Requested Plan</span>
                <span className="font-bold text-sm">{String(pendingFrequencyRequest.requested_frequency).replaceAll('_', ' ')}</span>
              </div>
              <div>
                <span className="block text-amber-800/80 font-medium">Status</span>
                <span className="font-bold text-sm px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full inline-block mt-0.5">Pending Approval</span>
              </div>
            </div>
            {pendingFrequencyRequest.reason && (
              <p className="text-xs text-amber-800 italic mt-2 border-t border-amber-200/40 pt-2">Reason: "{pendingFrequencyRequest.reason}"</p>
            )}
          </div>
        ) : (
          allowedFrequencies.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                <select
                  value={state.requestedFrequency}
                  onChange={(e) => dispatch({ type: 'SET_REQUESTED_FREQUENCY', payload: e.target.value })}
                  className="px-3 py-3 rounded-xl border border-border bg-background text-sm"
                >
                  {allowedFrequencies.map((frequency: string) => (
                    <option key={frequency} value={frequency}>{frequency.replaceAll('_', ' ')}</option>
                  ))}
                </select>
                <input
                  value={state.requestReason}
                  onChange={(e) => dispatch({ type: 'SET_REQUEST_REASON', payload: e.target.value })}
                  placeholder="Reason, e.g. parent salary cycle"
                  className="px-3 py-3 rounded-xl border border-border bg-background text-sm"
                />
              </div>
              <button
                type="button"
                disabled={frequencyMutation.isPending}
                onClick={() => frequencyMutation.mutate()}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-50 cursor-pointer"
              >
                {frequencyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Request Change
              </button>
            </div>
          )
        )}
      </section>

      {/* SECTION 7 – SECURITY DEPOSIT (TRUST CARD) */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Security Deposit</h2>
              <p className="text-xs text-muted-foreground font-medium">Secured deposit for move-in agreement</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            FULLY SECURED
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Required</span>
            <span className="font-extrabold text-foreground">{fmt(Number((advance as any)?.security_deposit ?? 0))}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block font-medium">Held by Hostel</span>
            <span className="font-extrabold text-emerald-600">{fmt(Number((advance as any)?.security_deposit_paid ?? 0))}</span>
          </div>
        </div>

        {/* Deposit Progress bar */}
        {Number((advance as any)?.security_deposit ?? 0) > 0 && (
          <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (Number((advance as any)?.security_deposit_paid ?? 0) / Number((advance as any)?.security_deposit ?? 1)) * 100)}%` }}
            ></div>
          </div>
        )}

        <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/80 p-3 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Refundable after move-out settlement</span>
        </div>
      </section>

      {/* SECTION 8 – FUTURE RENT CREDIT CARD */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Future Rent Credit</h2>
            <p className="text-xs text-muted-foreground font-medium">Prepaid balances applied automatically</p>
          </div>
        </div>

        <div className="pt-1">
          <span className="text-xs text-muted-foreground font-medium block">Available Credit</span>
          <span className="text-3xl font-black text-purple-600 tracking-tight block mt-0.5">
            {fmt(Number((advance as any)?.available_rent_advance ?? 0))}
          </span>
        </div>

        <p className="text-xs text-muted-foreground font-medium leading-relaxed bg-purple-50/40 p-3 rounded-xl border border-purple-100/50">
          Automatically applied to future rent installments.
        </p>
      </section>

      {/* SECTION 9 – PAYMENT HISTORY (COLLAPSIBLE) */}
      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_HISTORY_EXPANDED', payload: !state.historyExpanded })}
          className="flex items-center justify-between w-full p-5 hover:bg-muted/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Payment History</h2>
              <p className="text-xs text-muted-foreground">View and download invoices</p>
            </div>
          </div>
          {state.historyExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {allPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground p-5 border-t border-border text-center">
            No payments recorded yet
          </p>
        ) : (
          <div className="border-t border-border divide-y divide-border">
            {recentPayments.map((p) => (
              <div
                key={String(p.id)}
                onClick={() => dispatch({ type: 'SET_SELECTED_PAYMENT_FOR_DETAIL', payload: p })}
                className="flex items-center justify-between p-4 bg-card text-sm cursor-pointer hover:bg-muted/10 transition-colors"
              >
                <div>
                  <p className="font-extrabold text-foreground">{fmt(Number(p.amount ?? 0))}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-0.5">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.date ? fmtDate(p.date) : '—'} · {p.method}
                  </p>
                </div>
                {p.receipt_payment_id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReceipt(String(p.receipt_payment_id));
                    }}
                    className="p-2 rounded-lg text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                    aria-label="Download receipt"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {!state.historyExpanded && allPayments.length > 2 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_HISTORY_EXPANDED', payload: true })}
                className="w-full py-3 text-center text-xs font-semibold text-accent hover:bg-muted/5 transition-colors border-t border-border cursor-pointer flex items-center justify-center gap-1"
              >
                <span>View All ({allPayments.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* PAYMENT MODALS */}
      <TenantPaymentModal
        open={state.showPayModal}
        onClose={() => dispatch({ type: 'SET_SHOW_PAY_MODAL', payload: false })}
        amount={selectedTotal}
        obligationIds={state.selectedIds}
        paymentContext={selectedItems}
        onSuccess={handlePaymentSuccess}
      />

      <TenantPaymentModal
        open={state.showAdvancePayModal}
        onClose={() => dispatch({ type: 'SET_SHOW_ADVANCE_PAY_MODAL', payload: false })}
        amount={selectedProjectedTotal}
        obligationIds={[]}
        paymentType="ADVANCE"
        paymentContext={advancePaymentContext}
        onSuccess={() => {
          dispatch({ type: 'RECORD_ADVANCE_SUCCESS' });
          queryClient.invalidateQueries({ queryKey: ['tenant'] });
          toast.success('Prepayment recorded successfully!');
        }}
      />

      <TenantPaymentDetailModal
        open={!!state.selectedPaymentForDetail}
        onClose={() => dispatch({ type: 'SET_SELECTED_PAYMENT_FOR_DETAIL', payload: null })}
        payment={state.selectedPaymentForDetail}
        onDownloadReceipt={handleReceipt}
      />
    </div>
  );
}
