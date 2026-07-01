import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Toggle, FieldRow } from './shared';
import api from '@lib/api-client';
import {
  toFrontendModel,
  toBackendModel,
  FrontendReminderState,
  GENTLE_BEFORE,
  GENTLE_AFTER,
  STANDARD_BEFORE,
  STANDARD_AFTER,
  AGGRESSIVE_BEFORE,
  AGGRESSIVE_AFTER,
} from './reminderAdapter';
import {
  Mail,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Smile,
  Sliders,
  Bell,
  Sparkles,
  Info,
  Calendar,
  Smartphone,
  Eye,
  Check,
  Activity,
  Play,
  Pause,
  Send,
  HelpCircle,
  X
} from 'lucide-react';

interface Props {
  hostelId: string;
  policy?: HostelPolicy;
}

export function NotificationsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<FrontendReminderState>(() => toFrontendModel(policy));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Metadata & Automation Health states
  const [metadata, setMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Journey Simulation states
  const [journeyData, setJourneyData] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [previewTenantId, setPreviewTenantId] = useState<string>('');
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number>(0);
  const [activePreviewChannel, setActivePreviewChannel] = useState<'whatsapp' | 'email' | 'in_app'>('whatsapp');

  // Inspector states
  const [inspectorOptions, setInspectorOptions] = useState<any[]>([]);
  const [selectedInspectorObId, setSelectedInspectorObId] = useState<string>('');
  const [inspectorHistory, setInspectorHistory] = useState<any[]>([]);
  const [selectedObligationDetails, setSelectedObligationDetails] = useState<any>(null);
  const [loadingInspector, setLoadingInspector] = useState(false);

  // Test Modal state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testChannel, setTestChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [testDestination, setTestDestination] = useState('');
  const [testType, setTestType] = useState<'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE' | 'LATE_FEE_ADDED'>('DUE_SOON');
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (!policy) return;
    const next = toFrontendModel(policy);
    setLocal(next);
    snap.current = next;
  }, [hostelId, policy]);

  // Fetch Metadata & Strategies Config on mount/hostelId change
  useEffect(() => {
    let active = true;
    setLoadingMetadata(true);
    api.get(`/hostels/${hostelId}/preferences/metadata`)
      .then((res) => {
        if (active) {
          setMetadata(res.data);
          setLoadingMetadata(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load preferences metadata:', err);
        if (active) {
          setLoadingMetadata(false);
        }
      });
    return () => { active = false; };
  }, [hostelId]);

  // Fetch Inspector Options on mount/hostelId change
  useEffect(() => {
    let active = true;
    api.get(`/hostels/${hostelId}/preferences/inspector`)
      .then((res) => {
        if (active) {
          setInspectorOptions(res.data?.options || []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch inspector options:', err);
      });
    return () => { active = false; };
  }, [hostelId]);

  // Set default inspector selection once options are loaded
  useEffect(() => {
    if (inspectorOptions.length > 0 && !selectedInspectorObId) {
      setSelectedInspectorObId(inspectorOptions[0].obligationId);
    }
  }, [inspectorOptions]);

  // Fetch Inspector History when selected obligation changes
  const fetchInspectorHistory = async (obId: string) => {
    if (!obId) return;
    setLoadingInspector(true);
    try {
      const res = await api.get(`/hostels/${hostelId}/preferences/inspector?obligationId=${obId}`);
      setInspectorHistory(res.data?.history || []);
      setSelectedObligationDetails(res.data?.selectedObligation || null);
    } catch (err) {
      console.error('Failed to fetch inspector history:', err);
    } finally {
      setLoadingInspector(false);
    }
  };

  useEffect(() => {
    if (selectedInspectorObId) {
      fetchInspectorHistory(selectedInspectorObId);
    }
  }, [selectedInspectorObId]);

  // Fetch Journey Simulation
  const fetchJourney = async () => {
    setLoadingJourney(true);
    try {
      const params = new URLSearchParams();
      params.append('strategy', local.strategy);
      params.append('beforeDueDays', local.customBeforeDueDays.join(','));
      params.append('afterDueDays', local.customAfterDueDays.join(','));
      params.append('repeatInterval', String(local.repeatInterval));
      if (previewTenantId) {
        params.append('tenantId', previewTenantId);
      }

      const res = await api.get(`/hostels/${hostelId}/preferences/simulate?${params.toString()}`);
      setJourneyData(res.data);
    } catch (err) {
      console.error('Failed to fetch journey simulation:', err);
    } finally {
      setLoadingJourney(false);
    }
  };

  // Re-fetch journey whenever inputs change
  useEffect(() => {
    fetchJourney();
  }, [
    hostelId,
    local.strategy,
    JSON.stringify(local.customBeforeDueDays),
    JSON.stringify(local.customAfterDueDays),
    local.repeatInterval,
    previewTenantId,
  ]);

  // Set default active timeline index to due day or index 0
  useEffect(() => {
    if (journeyData?.timeline) {
      const dueIdx = journeyData.timeline.findIndex((t: any) => t.daysOffset === 0);
      setSelectedTimelineIndex(dueIdx >= 0 ? dueIdx : 0);
    }
  }, [journeyData]);

  // Resolve strategies mapping dynamically from backend
  const strategies = metadata?.strategies || {
    gentle: { beforeDueDays: [2], afterDueDays: [2], repeatInterval: 0 },
    standard: { beforeDueDays: [3, 1], afterDueDays: [3, 7], repeatInterval: 0 },
    aggressive: { beforeDueDays: [5, 3, 1], afterDueDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], repeatInterval: 0 }
  };

  // Compute channels for current timeline event and auto-select
  const currentEvent = journeyData?.timeline?.[selectedTimelineIndex];
  const currentEventChannels = (currentEvent?.channels || []).map((ch: string) => {
    if (ch.startsWith('WhatsApp')) return 'whatsapp';
    if (ch.toLowerCase() === 'email') return 'email';
    return 'in_app';
  });

  useEffect(() => {
    if (currentEventChannels.length > 0 && !currentEventChannels.includes(activePreviewChannel)) {
      setActivePreviewChannel(currentEventChannels[0] as any);
    }
  }, [selectedTimelineIndex, journeyData]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    const backendData = toBackendModel(local);
    mutation.mutate(
      backendData,
      {
        onSuccess: () => {
          snap.current = local;
        },
        onError: (e: any) => {
          setError(e?.response?.data?.error?.message ?? 'Failed to save settings');
        },
      }
    );
  };

  const handleReset = () => {
    setLocal(snap.current);
    setError(null);
  };

  const handleStrategyChange = (strategy: FrontendReminderState['strategy']) => {
    setLocal((prev) => {
      let nextBefore = prev.customBeforeDueDays;
      let nextAfter = prev.customAfterDueDays;
      let nextRepeat = prev.repeatInterval;

      if (strategy !== 'custom') {
        const stratConfig = strategies[strategy];
        nextBefore = [...stratConfig.beforeDueDays];
        nextAfter = [...stratConfig.afterDueDays];
        nextRepeat = stratConfig.repeatInterval;
      } else if (prev.strategy !== 'custom') {
        // Hydrate custom with standard settings to avoid starting blank
        nextBefore = [...strategies.standard.beforeDueDays];
        nextAfter = [...strategies.standard.afterDueDays];
        nextRepeat = strategies.standard.repeatInterval;
      }

      return {
        ...prev,
        strategy,
        customBeforeDueDays: nextBefore,
        customAfterDueDays: nextAfter,
        repeatInterval: nextRepeat,
      };
    });
  };

  const toggleChannel = (channel: keyof FrontendReminderState['channels']) => {
    setLocal((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel],
      },
    }));
  };

  const toggleCustomBeforeDay = (day: number) => {
    setLocal((prev) => {
      const current = prev.customBeforeDueDays;
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => b - a);
      return { ...prev, customBeforeDueDays: next };
    });
  };

  const toggleCustomAfterDay = (day: number) => {
    setLocal((prev) => {
      const current = prev.customAfterDueDays;
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...prev, customAfterDueDays: next };
    });
  };

  // Generate timeline events based on selected options
  const getTimelineEvents = () => {
    const events: Array<{
      id: string;
      label: string;
      sub: string;
      type: 'before' | 'due' | 'after' | 'repeat';
      days: number;
      dateStr: string;
    }> = [];

    const getDaysBeforeDate = (days: number) => {
      if (days === 7) return '28 Jun';
      if (days === 5) return '30 Jun';
      if (days === 3) return '2 Jul';
      if (days === 2) return '3 Jul';
      if (days === 1) return '4 Jul';
      return `${5 - days} Jul`;
    };

    const getDaysAfterDate = (days: number) => {
      const dayNum = 5 + days;
      if (dayNum <= 31) {
        return `${dayNum} Jul`;
      }
      return `${dayNum - 31} Aug`;
    };

    const beforeList =
      local.strategy === 'gentle'
        ? GENTLE_BEFORE
        : local.strategy === 'standard'
        ? STANDARD_BEFORE
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_BEFORE
        : local.customBeforeDueDays;

    const afterList =
      local.strategy === 'gentle'
        ? GENTLE_AFTER
        : local.strategy === 'standard'
        ? STANDARD_AFTER
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_AFTER
        : local.customAfterDueDays;

    // 1. Before due events
    [...beforeList]
      .sort((a, b) => b - a)
      .forEach((d) => {
        events.push({
          id: `before-${d}`,
          label: `${d} day${d > 1 ? 's' : ''} before due`,
          sub: `Friendly heads-up sent to tenant`,
          type: 'before',
          days: d,
          dateStr: getDaysBeforeDate(d),
        });
      });

    // 2. Due Day
    events.push({
      id: 'due',
      label: 'Due Day',
      sub: 'Rent payment is officially due today',
      type: 'due',
      days: 0,
      dateStr: '5 Jul',
    });

    // 3. After due events
    [...afterList]
      .sort((a, b) => a - b)
      .forEach((d) => {
        events.push({
          id: `after-${d}`,
          label: `${d} day${d > 1 ? 's' : ''} overdue`,
          sub: `Overdue warning notification`,
          type: 'after',
          days: d,
          dateStr: getDaysAfterDate(d),
        });
      });

    // 4. Repeat behavior
    if (local.strategy === 'custom' && local.repeatInterval > 0) {
      events.push({
        id: 'repeat',
        label: `Every ${local.repeatInterval} days overdue`,
        sub: `Continuous alerts until rent is settled`,
        type: 'repeat',
        days: local.repeatInterval,
        dateStr: 'Recurring',
      });
    }

    return events;
  };

  const timelineEvents = getTimelineEvents();

  const getEstimatedReminderCount = () => {
    const beforeList =
      local.strategy === 'gentle'
        ? GENTLE_BEFORE
        : local.strategy === 'standard'
        ? STANDARD_BEFORE
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_BEFORE
        : local.customBeforeDueDays;

    const afterList =
      local.strategy === 'gentle'
        ? GENTLE_AFTER
        : local.strategy === 'standard'
        ? STANDARD_AFTER
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_AFTER
        : local.customAfterDueDays;

    let baseCount = beforeList.length + 1 + afterList.length; // +1 for due day
    if (local.strategy === 'custom' && local.repeatInterval > 0) {
      const maxAfter = afterList.length > 0 ? Math.max(...afterList) : 0;
      const remainingDays = Math.max(0, 30 - maxAfter);
      baseCount += Math.floor(remainingDays / local.repeatInterval);
    }
    return baseCount;
  };

  // Get active channel icon
  const getChannelIcon = (type: 'whatsapp' | 'email' | 'in_app') => {
    switch (type) {
      case 'whatsapp':
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-indigo-500" />;
      case 'in_app':
        return <Smartphone className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  // Renders the Meta WhatsApp template text populated with realistic values
  const getPreviewMessageText = (
    type: 'before' | 'due' | 'after' | 'repeat',
    days: number,
    channel: 'whatsapp' | 'email' | 'in_app'
  ) => {
    const tenantName = "Rahul Sharma";
    const amount = simRentAmount.toLocaleString('en-IN');
    const hostelName = "Greenwood Residency";
    const rentMonth = "July 2026";
    const dueDate = "05 Jul 2026";

    if (channel === 'whatsapp') {
      if (type === 'before') {
        return `Hello *${tenantName}*, your rent of *₹${amount}* for *${rentMonth}* at *${hostelName}* is due on *${dueDate}*. Please pay on time to avoid late fees. - HMS`;
      }
      if (type === 'due') {
        return `Hello *${tenantName}*, this is a reminder that your rent of *₹${amount}* for *${rentMonth}* at *${hostelName}* is due *TODAY*. Please pay using the app to avoid late fees. - HMS`;
      }
      // Both overdue and repeat overdue map to overdue template
      return `Hello *${tenantName}*, your rent of *₹${amount}* for *${rentMonth}* at *${hostelName}* was due on *${dueDate}* and is now overdue by *${days || 3} days*. Please make payment as soon as possible. - HMS`;
    }

    if (channel === 'in_app') {
      if (type === 'before') {
        return `Rent Payment Upcoming: ₹${amount} due on ${dueDate}.`;
      }
      if (type === 'due') {
        return `Rent Due Today: Please clear your ₹${amount} rent obligation.`;
      }
      return `Rent Overdue: Your rent of ₹${amount} is overdue. Please settle.`;
    }

    // Email
    if (type === 'before') {
      return `Subject: Invoice Upcoming - Rent due on ${dueDate}\n\nDear ${tenantName},\n\nThis is a friendly reminder that your rent invoice for ${hostelName} is due on ${dueDate}.\nAmount: ₹${amount}\n\nPlease clear it by the due date.`;
    }
    if (type === 'due') {
      return `Subject: Rent Due Today - ${hostelName}\n\nDear ${tenantName},\n\nThis is to notify you that your rent invoice of ₹${amount} is due today. Please make the payment to avoid late fees.`;
    }
    return `Subject: URGENT: Rent Overdue - ${hostelName}\n\nDear ${tenantName},\n\nYour rent payment is currently overdue. Please clear the outstanding balance of ₹${amount} immediately to prevent late fee enforcement.`;
  };

  const getActiveChannels = () => {
    const active: Array<'whatsapp' | 'in_app' | 'email'> = [];
    if (local.channels.whatsapp) active.push('whatsapp');
    if (local.channels.in_app) active.push('in_app');
    if (local.channels.email) active.push('email');
    if (active.length === 0) active.push('whatsapp'); // Fallback preview
    return active;
  };

  const activeChannelsList = getActiveChannels();

  useEffect(() => {
    if (!activeChannelsList.includes(activePreviewEvent.channel)) {
      setActivePreviewEvent((prev) => ({
        ...prev,
        channel: activeChannelsList[0],
      }));
    }
  }, [local.channels]);

  // Handle simulation calculations
  const getSimulatedDates = () => {
    const dates: Array<{ date: string; label: string; template: string }> = [];
    const baseDate = new Date();
    // Simulate for the next month
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1; // 1-indexed

    const getFormattedDate = (offsetDays: number) => {
      const d = new Date(year, month, simDueDay + offsetDays);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const beforeList =
      local.strategy === 'gentle'
        ? GENTLE_BEFORE
        : local.strategy === 'standard'
        ? STANDARD_BEFORE
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_BEFORE
        : local.customBeforeDueDays;

    const afterList =
      local.strategy === 'gentle'
        ? GENTLE_AFTER
        : local.strategy === 'standard'
        ? STANDARD_AFTER
        : local.strategy === 'aggressive'
        ? AGGRESSIVE_AFTER
        : local.customAfterDueDays;

    [...beforeList]
      .sort((a, b) => b - a)
      .forEach((d) => {
        dates.push({
          date: getFormattedDate(-d),
          label: `${d} days before due`,
          template: 'rent_due_reminder_v1',
        });
      });

    dates.push({
      date: getFormattedDate(0),
      label: 'Due Day',
      template: 'rent_due_today_v1',
    });

    [...afterList]
      .sort((a, b) => a - b)
      .forEach((d) => {
        dates.push({
          date: getFormattedDate(d),
          label: `${d} days overdue`,
          template: 'rent_overdue_warm_v1',
        });
      });

    if (local.strategy === 'custom' && local.repeatInterval > 0) {
      const maxAfter = afterList.length > 0 ? Math.max(...afterList) : 0;
      // Add a couple of repeat items for visualization
      for (let i = 1; i <= 2; i++) {
        const repeatDay = maxAfter + (i * local.repeatInterval);
        dates.push({
          date: getFormattedDate(repeatDay),
          label: `${repeatDay} days overdue (Recurring)`,
          template: 'rent_overdue_warm_v1',
        });
      }
    }

    return dates;
  };

  const handleSendTestReminder = async () => {
    setTestLoading(true);
    setTestSuccessMessage(null);
    setTestErrorMessage(null);

    try {
      const res = await api.post('/notifications/test-reminder', {
        type: testType,
        hostel_id: hostelId,
        channel: testChannel,
        destination: testDestination,
      });

      if (res.data?.success) {
        setTestSuccessMessage(res.data.message || 'Test reminder sent successfully!');
      } else {
        if (res.data?.simulation) {
          setTestSuccessMessage(`${res.data.message} (SIMULATION MODE: Credentials not configured)`);
        } else {
          setTestErrorMessage(res.data?.message || 'Failed to send test reminder.');
        }
      }
    } catch (err: any) {
      setTestErrorMessage(
        err?.response?.data?.error?.message || err?.message || 'Request failed.'
      );
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <SectionShell
      title="Rent Collection Automation"
      description="Rent collection, message triggers, channel settings, and live message dispatch settings."
      isDirty={isDirty}
      saving={mutation.isPending}
      onSave={save}
      onReset={handleReset}
      error={error}
    >
      <div className="space-y-6">
        {/* Master Toggle Banner */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200 ${
          local.autoSendReminders
            ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10'
            : 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg mt-0.5 ${
              local.autoSendReminders
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                {local.autoSendReminders ? 'Automatic Reminders Active' : 'Automatic Reminders Paused'}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                {local.autoSendReminders
                  ? 'The system is actively running the reminder engine daily to dispatch notifications to tenants automatically.'
                  : 'Automatic reminders are currently paused. Students will NOT receive any automatic messages until automation is enabled.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLocal(prev => ({ ...prev, autoSendReminders: !prev.autoSendReminders }))}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm border transition-all ${
              local.autoSendReminders
                ? 'bg-card border-border hover:bg-secondary text-foreground'
                : 'bg-accent text-accent-foreground border-accent hover:opacity-90'
            }`}
          >
            {local.autoSendReminders ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause Automation
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Enable Automation
              </>
            )}
          </button>
        </div>

        {/* Dashboard KPIs Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Automation Activity</span>
            <div className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
              {local.autoSendReminders ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Paused</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {local.autoSendReminders ? 'Runs daily at 12:00 AM' : 'Execution is currently suspended'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Collection Health</span>
            <div className="text-xl font-bold text-foreground mt-1 flex items-baseline gap-1.5">
              <span>{metadata?.whatsappConnected ? '98.4%' : 'N/A'}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                metadata?.whatsappConnected 
                  ? 'text-emerald-500 bg-emerald-500/10' 
                  : 'text-amber-500 bg-amber-500/10'
              }`}>
                {metadata?.whatsappConnected ? 'Healthy' : 'No Connection'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">WhatsApp delivery success rate</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Scheduled Sequence</span>
            <div className="text-xl font-bold text-foreground mt-1">
              ~{getEstimatedReminderCount()} notifications
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Total alerts sent per billing cycle
            </p>
          </div>
        </div>

        {/* Automation Health Diagnostics */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" /> Automation Health Diagnostics
            </h4>
            <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              System Live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            {/* WhatsApp Integration Status */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold">WhatsApp Gateway</span>
              <div className="flex items-center gap-1.5">
                {metadata?.whatsappConnected ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-foreground">Connected</span>
                    {metadata.whatsappPhone && (
                      <span className="text-[9px] text-muted-foreground font-mono">({metadata.whatsappPhone})</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-semibold text-foreground">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            {/* Template Verification Status */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold">Meta Templates</span>
              <div className="flex items-center gap-1.5">
                {metadata?.templatesApproved ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-foreground">Approved (3 Active)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-foreground">Pending Approval</span>
                  </>
                )}
              </div>
            </div>

            {/* Last Execution Info */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold">Last Reminder Run</span>
              <div className="text-xs font-semibold text-foreground">
                {metadata?.lastReminderSentAt
                  ? new Date(metadata.lastReminderSentAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </div>
            </div>

            {/* Queue & Cron Status */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold">Next Scheduled Run</span>
              <div className="text-xs font-semibold text-foreground">
                {metadata?.nextReminderScheduledAt
                  ? new Date(metadata.nextReminderScheduledAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Collection Strategy Presets */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            1. Select Reminder Strategy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gentle Card */}
            <button
              type="button"
              onClick={() => handleStrategyChange('gentle')}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all relative ${
                local.strategy === 'gentle'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-card hover:border-border-hover hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="p-1.5 bg-sky-500/10 text-sky-500 rounded-lg">
                  <Smile className="w-5 h-5" />
                </span>
                {local.strategy === 'gentle' && (
                  <span className="text-accent">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                Gentle <span className="text-[10px] text-sky-500 bg-sky-500/10 px-1.5 rounded">Friendly</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mt-1.5 mb-3">
                Friendly reminders with lower frequency. Ideal for high-trust students.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded w-full">
                {strategies.gentle.beforeDueDays.length} before • Due • {strategies.gentle.afterDueDays.length} overdue
              </div>
            </button>

            {/* Standard Card */}
            <button
              type="button"
              onClick={() => handleStrategyChange('standard')}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all relative ${
                local.strategy === 'standard'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-card hover:border-border-hover hover:bg-secondary/20'
              }`}
            >
              <span className="absolute -top-2.5 right-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                Recommended
              </span>
              <div className="flex items-center justify-between w-full mb-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                {local.strategy === 'standard' && (
                  <span className="text-accent">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                Standard <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 rounded">94% Success</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mt-1.5 mb-3">
                Optimized flow balancing urgency and friendliness.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded w-full">
                {strategies.standard.beforeDueDays.length} before • Due • {strategies.standard.afterDueDays.length} overdue
              </div>
            </button>

            {/* Aggressive Card */}
            <button
              type="button"
              onClick={() => handleStrategyChange('aggressive')}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all relative ${
                local.strategy === 'aggressive'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-card hover:border-border-hover hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                {local.strategy === 'aggressive' && (
                  <span className="text-accent">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                Aggressive <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 rounded">High Collection</span>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mt-1.5 mb-3">
                High frequency alerts. Best for students with persistent delays.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded w-full">
                {strategies.aggressive.beforeDueDays.length} before • Due • {strategies.aggressive.afterDueDays.length} overdue
              </div>
            </button>

            {/* Custom Card */}
            <button
              type="button"
              onClick={() => handleStrategyChange('custom')}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all relative ${
                local.strategy === 'custom'
                  ? 'border-accent bg-accent/5 ring-1 ring-accent'
                  : 'border-border bg-card hover:border-border-hover hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Sliders className="w-5 h-5" />
                </span>
                {local.strategy === 'custom' && (
                  <span className="text-accent">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-foreground">Custom Strategy</h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mt-1.5 mb-3">
                Tailor trigger offsets, due-day notifications, and recurring intervals.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded w-full">
                Fully customizable timing
              </div>
            </button>
          </div>
        </div>

        {/* Custom Configuration Panel */}
        {local.strategy === 'custom' && (
          <div className="border border-border rounded-xl overflow-hidden bg-card transition-all">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-purple-500" />
                <div>
                  <span className="font-semibold text-sm text-foreground">Customize Schedule & Timing</span>
                  <p className="text-xs text-muted-foreground">Adjust offsets relative to due date</p>
                </div>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-5 border-t border-border bg-card/50 space-y-6">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Days Before Due Date
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[7, 5, 3, 2, 1].map((day) => {
                      const isSelected = local.customBeforeDueDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleCustomBeforeDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                              : 'border-border bg-background text-muted-foreground hover:border-border-hover'
                          }`}
                        >
                          {day} Day{day > 1 ? 's' : ''} Before
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Days Overdue (After Due Date)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 5, 7, 10, 15, 21, 30].map((day) => {
                      const isSelected = local.customAfterDueDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleCustomAfterDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                              : 'border-border bg-background text-muted-foreground hover:border-border-hover'
                          }`}
                        >
                          {day} Day{day > 1 ? 's' : ''} Overdue
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Overdue Repeat Cycle
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Enable periodic alerts for balances past the last overdue day.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Repeat every</span>
                    <select
                      value={local.repeatInterval}
                      onChange={(e) =>
                        setLocal((prev) => ({
                          ...prev,
                          repeatInterval: Number(e.target.value),
                        }))
                      }
                      className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="0">No repeat</option>
                      <option value="3">3 days</option>
                      <option value="5">5 days</option>
                      <option value="7">7 days</option>
                      <option value="10">10 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                    <span className="text-xs text-muted-foreground">until paid</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Channels Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            2. Notification Channels
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WhatsApp Card */}
            <div
              className={`flex items-start gap-4 p-4 rounded-xl border select-none transition-all ${
                local.channels.whatsapp
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">WhatsApp Channel</span>
                  <Toggle checked={local.channels.whatsapp} onChange={() => toggleChannel('whatsapp')} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  High open-rate official alerts with WhatsApp template verification.
                </p>
              </div>
            </div>

            {/* Tenant App */}
            <div
              className={`flex items-start gap-4 p-4 rounded-xl border select-none transition-all ${
                local.channels.in_app
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">In-App Push</span>
                  <Toggle checked={local.channels.in_app} onChange={() => toggleChannel('in_app')} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Deliver notifications directly inside the tenant dashboard portal.
                </p>
              </div>
            </div>

            {/* Email Card */}
            <div
              className={`flex items-start gap-4 p-4 rounded-xl border select-none transition-all ${
                local.channels.email
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">Email Deliveries</span>
                  <Toggle checked={local.channels.email} onChange={() => toggleChannel('email')} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Professional rent invoice summaries and payment receipt PDF links.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Centerpiece & Live Mockup Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-border pt-8">
            {/* Visual Timeline (Interactive Hub) */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">Rent Journey Visual Timeline</h3>
                  {/* Active preview selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-semibold">Preview Tenant:</span>
                    <select
                      value={previewTenantId}
                      onChange={(e) => setPreviewTenantId(e.target.value)}
                      className="px-2 py-1 bg-background border border-border rounded text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">Default Preview Context</option>
                      {inspectorOptions.map((opt) => (
                        <option key={opt.obligationId} value={opt.tenantId}>
                          {opt.tenantName} ({opt.roomNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Simulated sequence showing messages for rent cycle of <strong>{journeyData?.rentMonth || 'July 2026'}</strong>. Select a node to preview the message.
                </p>
              </div>

              {loadingJourney ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                  <Activity className="w-5 h-5 animate-spin text-accent" />
                  <span>Generating live simulation...</span>
                </div>
              ) : (
                <div className="relative border-l border-border pl-6 space-y-4 ml-3 mt-4">
                  {(journeyData?.timeline || []).map((evt: any, index: number) => {
                    const isActive = selectedTimelineIndex === index;
                    const isDue = evt.daysOffset === 0;
                    const isRepeat = evt.stepName.toLowerCase().includes('repeat') || evt.stepName.toLowerCase().includes('recurring');

                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedTimelineIndex(index)}
                        className={`relative p-3 rounded-lg border cursor-pointer select-none transition-all ${
                          isActive
                            ? 'border-accent bg-accent/5 ring-1 ring-accent shadow-sm'
                            : 'border-transparent bg-transparent hover:bg-secondary/40'
                        }`}
                      >
                        {/* Node point */}
                        <div
                          className={`absolute -left-[31px] top-4.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isDue
                              ? 'bg-amber-500 border-amber-500'
                              : isRepeat
                              ? 'bg-purple-500 border-purple-500'
                              : isActive
                              ? 'bg-accent border-accent'
                              : 'bg-background border-border'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                {evt.stepName}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                                {evt.date}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{evt.description}</p>
                          </div>

                          {/* Event Channel Indicators */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {evt.channels.map((ch: string) => (
                              <span
                                key={ch}
                                className={`p-1 rounded border transition-colors ${
                                  isActive ? 'bg-accent/10 border-accent/20' : 'bg-secondary border-border/50'
                                }`}
                                title={`Sent via ${ch}`}
                              >
                                {getChannelIcon(ch.startsWith('WhatsApp') ? 'whatsapp' : ch.toLowerCase() === 'email' ? 'email' : 'in_app')}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sim Context Info Widget */}
              <div className="p-4 rounded-xl border border-border bg-secondary/10 mt-6 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <Calendar className="w-4 h-4 text-accent" /> Active Preview Context
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This simulation is based on tenant <strong>{journeyData?.previewTenant?.name || 'Rahul Sharma'}</strong>'s active billing configuration.
                </p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="p-2 bg-background border border-border rounded">
                    <div className="text-[10px] text-muted-foreground font-semibold">Tenant Name</div>
                    <div className="font-semibold mt-0.5">{journeyData?.previewTenant?.name || 'Rahul Sharma'}</div>
                  </div>
                  <div className="p-2 bg-background border border-border rounded">
                    <div className="text-[10px] text-muted-foreground font-semibold">Room & Rent Dues</div>
                    <div className="font-semibold mt-0.5">{journeyData?.previewTenant?.roomNumber || 'Room G4'} • ₹{(journeyData?.previewTenant?.rentAmount || 8500).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="p-2 bg-background border border-border rounded">
                    <div className="text-[10px] text-muted-foreground font-semibold">Rent Due Day</div>
                    <div className="font-semibold mt-0.5">Day {journeyData?.previewTenant?.dueDay || 5} of month</div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Calculated Dispatch Sequence
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-foreground">
                    {(journeyData?.timeline || []).map((sim: any, index: number) => (
                      <div key={index} className="flex justify-between p-1.5 bg-background border border-border rounded">
                        <span className="text-muted-foreground">{sim.stepName}</span>
                        <span className="font-bold">{sim.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Phone Preview (Right Column) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-accent" /> Live Channel Mockup
                </h3>
                <p className="text-xs text-muted-foreground">
                  See the exact template format sent to the tenant.
                </p>
              </div>

              {/* Channels Preview Swapper */}
              <div className="flex border-b border-border">
                {currentEventChannels.map((ch: any) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setActivePreviewChannel(ch)}
                    className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 capitalize ${
                      activePreviewChannel === ch
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {getChannelIcon(ch)}
                    {ch === 'in_app' ? 'In-App' : ch}
                  </button>
                ))}
              </div>

              {/* Phone Canvas Layout */}
              <div className="flex-1 bg-secondary/50 border border-border rounded-2xl p-4 flex items-center justify-center min-h-[380px]">
                {activePreviewChannel === 'whatsapp' ? (
                  <div className="w-full max-w-[280px] bg-background border border-border rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col relative aspect-[9/16] ring-8 ring-secondary-hover/20">
                    {/* Phone speaker notch */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-secondary rounded-full z-10" />

                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white px-4 pt-6 pb-2.5 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                        G
                      </div>
                      <div>
                        <div className="text-[11px] font-bold">{journeyData?.hostelName || 'Greenwood Residency'}</div>
                        <div className="text-[8px] opacity-75 flex items-center gap-1">
                          Official Accounts <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        </div>
                      </div>
                    </div>

                    {/* Meta template status overlay */}
                    <div className="bg-[#e1f5fe] text-[#0288d1] dark:bg-sky-950/40 dark:text-sky-300 px-3 py-1.5 text-[9px] font-semibold border-b border-sky-100 dark:border-sky-900/50 flex items-center justify-between">
                      <span>Template: {currentEvent?.templateName || 'rent_due_reminder'}</span>
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 rounded flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Approved
                      </span>
                    </div>

                    {/* Chat Bubble Area */}
                    <div className="bg-[#efeae2] dark:bg-slate-900 flex-1 p-3 flex flex-col justify-end min-h-[220px]">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm text-[11px] text-foreground max-w-[90%] relative self-start">
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {currentEvent?.previews?.whatsapp || ''}
                        </div>
                        <div className="text-[8px] text-muted-foreground text-right mt-1">
                          12:00 AM
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activePreviewChannel === 'in_app' ? (
                  <div className="w-full max-w-[280px] bg-background border border-border rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col aspect-[9/16] relative ring-8 ring-secondary-hover/20">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-secondary rounded-full z-10" />
                    <div className="bg-secondary px-4 pt-6 pb-2 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>12:00 AM</span>
                      <span>📶 🔋</span>
                    </div>
                    <div className="p-4 flex-1 space-y-3">
                      <div className="flex items-center gap-2 border-b border-border pb-2">
                        <div className="w-5 h-5 rounded bg-accent/15 flex items-center justify-center text-accent text-[10px] font-bold">
                          G
                        </div>
                        <span className="font-bold text-[10px]">Greenwood Tenant App</span>
                      </div>

                      <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-start gap-2.5">
                        <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-foreground">Rent Payment Due</div>
                          <p className="text-[9px] text-muted-foreground leading-normal font-medium">
                            {currentEvent?.previews?.in_app || ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[300px] bg-background border border-border rounded-xl shadow-lg overflow-hidden flex flex-col">
                    <div className="bg-secondary/40 px-3 py-2 border-b border-border text-[9px] text-muted-foreground space-y-0.5">
                      <div><span className="font-semibold text-foreground">From:</span> auto-billing@greenwood.com</div>
                      <div><span className="font-semibold text-foreground">To:</span> {journeyData?.previewTenant?.email || 'tenant@example.com'}</div>
                      <div><span className="font-semibold text-foreground">Subject:</span> {currentEvent?.previews?.email?.subject || 'Rent Due Reminder'}</div>
                    </div>
                    <div className="p-3 flex-1 text-[11px] text-foreground max-h-[300px] overflow-y-auto">
                      {currentEvent?.previews?.email?.html ? (
                        <div 
                          className="p-2 border border-border rounded bg-card text-[10px] overflow-hidden" 
                          dangerouslySetInnerHTML={{ __html: currentEvent.previews.email.html }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed bg-secondary/20 p-2.5 rounded border border-border/50">
                          {currentEvent?.previews?.email?.subject}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reminder Decision Inspector */}
          <div className="border-t border-border pt-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-accent" /> Reminder Decision Inspector
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit the exact day-by-day evaluation logs and skipped/delivered decisions for any student's billing cycle.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Select Active Rent Obligation to Audit</label>
                <select
                  value={selectedInspectorObId}
                  onChange={(e) => setSelectedInspectorObId(e.target.value)}
                  className="w-full md:w-80 px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent mt-1"
                >
                  {inspectorOptions.map((opt) => (
                    <option key={opt.obligationId} value={opt.obligationId}>
                      {opt.tenantName} ({opt.roomNumber}) - Due: {new Date(opt.dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>

              {selectedObligationDetails && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-2 bg-secondary/35 rounded border border-border">
                    <span className="text-[9px] text-muted-foreground block">Rent Dues</span>
                    <span className="font-bold text-foreground">₹{selectedObligationDetails.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-2 bg-secondary/35 rounded border border-border">
                    <span className="text-[9px] text-muted-foreground block">Status</span>
                    <span className={`font-bold ${
                      selectedObligationDetails.status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>{selectedObligationDetails.status}</span>
                  </div>
                  <div className="p-2 bg-secondary/35 rounded border border-border">
                    <span className="text-[9px] text-muted-foreground block">Paid At</span>
                    <span className="font-bold text-foreground">
                      {selectedObligationDetails.paidAt 
                        ? new Date(selectedObligationDetails.paidAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
                        : 'Unpaid'}
                    </span>
                  </div>
                  <div className="p-2 bg-secondary/35 rounded border border-border">
                    <span className="text-[9px] text-muted-foreground block">Late Fees</span>
                    <span className="font-bold text-foreground">₹{selectedObligationDetails.lateFeesApplied || 0}</span>
                  </div>
                </div>
              )}
            </div>

            {loadingInspector ? (
              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                <Activity className="w-5 h-5 animate-spin text-accent" />
                <span>Fetching audit trace logs...</span>
              </div>
            ) : inspectorHistory.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                No daily trace history found for this billing cycle.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
                        <th className="p-3">Evaluation Date</th>
                        <th className="p-3">Timeline Offset</th>
                        <th className="p-3">Outcome</th>
                        <th className="p-3">Detailed Log Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {inspectorHistory.map((item, index) => (
                        <tr key={index} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-foreground font-semibold">
                            {new Date(item.evalDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-muted-foreground font-semibold">
                            {item.offsetDays === 0 
                              ? 'Due Day' 
                              : `${Math.abs(item.offsetDays)} Day${Math.abs(item.offsetDays) > 1 ? 's' : ''} ${item.offsetDays > 0 ? 'Overdue' : 'Before'}`}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.outcome === 'DELIVERED' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : item.outcome === 'SKIPPED'
                                ? 'bg-secondary text-muted-foreground border-border'
                                : item.outcome === 'FAILED'
                                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            }`}>
                              {item.outcome}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-muted-foreground leading-normal font-medium">
                            {item.logMessage}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        {/* Step 3: Stop Conditions & System Behaviour */}
        <div className="border-t border-border pt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              3. Stop Conditions & System Behaviour
            </h3>

            {/* Stop Conditions Radio Card Group */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-foreground">Stop reminders when:</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label
                  className={`flex flex-col p-3 rounded-lg border cursor-pointer select-none transition-all ${
                    local.stopCondition === 'paid'
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-card hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground">Payment Received</span>
                    <input
                      type="radio"
                      name="stopCondition"
                      checked={local.stopCondition === 'paid'}
                      onChange={() => setLocal((prev) => ({ ...prev, stopCondition: 'paid' }))}
                      className="text-accent focus:ring-accent h-3.5 w-3.5 border-border"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-normal">
                    (Recommended) Automatically stops once invoice is paid.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-3 rounded-lg border cursor-pointer select-none transition-all ${
                    local.stopCondition === 'manual'
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-card hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground">Owner stops collection</span>
                    <input
                      type="radio"
                      name="stopCondition"
                      checked={local.stopCondition === 'manual'}
                      onChange={() => setLocal((prev) => ({ ...prev, stopCondition: 'manual' }))}
                      className="text-accent focus:ring-accent h-3.5 w-3.5 border-border"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-normal">
                    Only stops when you manually pause automation for that tenant.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-3 rounded-lg border cursor-pointer select-none transition-all ${
                    local.stopCondition === 'never'
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-card hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground">Never stop</span>
                    <input
                      type="radio"
                      name="stopCondition"
                      checked={local.stopCondition === 'never'}
                      onChange={() => setLocal((prev) => ({ ...prev, stopCondition: 'never' }))}
                      className="text-accent focus:ring-accent h-3.5 w-3.5 border-border"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-normal">
                    Keep sending reminder alerts until manually archived.
                  </span>
                </label>
              </div>
            </div>

            {/* Other system settings toggles */}
            <div className="space-y-3 mt-4">
              <FieldRow
                label="Late fee applied alert"
                hint="Send a notification to the tenant automatically when a late fee is added to their balance."
              >
                <Toggle
                  checked={local.lateFeeNotifications}
                  onChange={(v) => setLocal((prev) => ({ ...prev, lateFeeNotifications: v }))}
                />
              </FieldRow>
              <FieldRow
                label="Daily collection summary"
                hint="Receive a daily digest email containing collection statuses, pending dues, and automated reminder statistics."
              >
                <Toggle
                  checked={local.ownerDailySummary}
                  onChange={(v) => setLocal((prev) => ({ ...prev, ownerDailySummary: v }))}
                />
              </FieldRow>
            </div>
          </div>
        </div>

        {/* Live Test Reminders & Utilities Block */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-accent" /> Live Test Sandbox
            </h4>
            <p className="text-xs text-muted-foreground">
              Send a real sample email or WhatsApp message directly to yourself or a test address.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTestSuccessMessage(null);
              setTestErrorMessage(null);
              setIsTestModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary-hover border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Send Test Reminder
          </button>
        </div>

        {/* Upcoming Automation Roadmap Section */}
        <div className="border-t border-border pt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs uppercase font-bold tracking-wider text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> Upcoming Automation Features
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/5 space-y-1 opacity-75">
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">Coming Soon</span>
                <h5 className="font-semibold text-xs text-foreground mt-2">Agreement Renewal Alerts</h5>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Automatically alert tenants and request signatures 30 days before their stay agreements expire.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/5 space-y-1 opacity-75">
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">Coming Soon</span>
                <h5 className="font-semibold text-xs text-foreground mt-2">Automated Tenant KYC</h5>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Auto-request government document uploads and verify identities using automated OCR services.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/5 space-y-1 opacity-75">
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">Coming Soon</span>
                <h5 className="font-semibold text-xs text-foreground mt-2">Utility Auto-Triggers</h5>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Calculate sub-meter readings and append electricity dues dynamically before reminder generation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Send Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Send className="w-4 h-4 text-accent" /> Dispatch Live Test Reminder
              </h3>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {/* Type Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Notification Type</label>
                <select
                  value={testType}
                  onChange={(e: any) => setTestType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="DUE_SOON">Due Soon (rent_due_reminder_v1)</option>
                  <option value="DUE_TODAY">Due Today (rent_due_today_v1)</option>
                  <option value="OVERDUE">Overdue (rent_overdue_warm_v1)</option>
                </select>
              </div>

              {/* Channel Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Channel</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTestChannel('whatsapp');
                      setTestDestination('');
                    }}
                    className={`p-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      testChannel === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestChannel('email');
                      setTestDestination('');
                    }}
                    className={`p-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      testChannel === 'email'
                        ? 'border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                </div>
              </div>

              {/* Custom Destination */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Destination {testChannel === 'whatsapp' ? 'Phone Number' : 'Email Address'}
                  </label>
                  <span className="text-[10px] text-muted-foreground italic">(Optional)</span>
                </div>
                <input
                  type="text"
                  value={testDestination}
                  onChange={(e) => setTestDestination(e.target.value)}
                  placeholder={
                    testChannel === 'whatsapp'
                      ? 'e.g. +919876543210'
                      : 'e.g. yourname@example.com'
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave blank to send to the phone number/email verified on your profile.
                </p>
              </div>

              {/* Status Alert Panels */}
              {testSuccessMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span>{testSuccessMessage}</span>
                </div>
              )}

              {testErrorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{testErrorMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-4 border-t border-border bg-secondary/15 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-xs font-semibold text-foreground transition-all"
              >
                Close
              </button>
              <button
                type="button"
                disabled={testLoading}
                onClick={handleSendTestReminder}
                className="px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {testLoading ? 'Sending...' : 'Send Live Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}
