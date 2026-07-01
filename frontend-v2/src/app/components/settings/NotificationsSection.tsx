import { useState, useEffect, useRef } from 'react';
import { useUpdateHostelPolicy, HostelPolicy } from '@features/settings/settingsHooks';
import { SectionShell, Toggle, FieldRow } from './shared';
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
  Check
} from 'lucide-react';

interface Props {
  hostelId: string;
  policy?: HostelPolicy;
}

export function NotificationsSection({ hostelId, policy }: Props) {
  const [local, setLocal] = useState<FrontendReminderState>(() => toFrontendModel(policy?.reminders));
  const snap = useRef(local);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreviewEvent, setActivePreviewEvent] = useState<{
    id: string;
    type: 'before' | 'due' | 'after' | 'repeat';
    days: number;
    channel: 'whatsapp' | 'email' | 'in_app';
  }>({ id: 'due', type: 'due', days: 0, channel: 'whatsapp' });

  const mutation = useUpdateHostelPolicy(hostelId);

  useEffect(() => {
    if (!policy) return;
    const next = toFrontendModel(policy.reminders);
    setLocal(next);
    snap.current = next;
  }, [hostelId, policy]);

  const isDirty = JSON.stringify(local) !== JSON.stringify(snap.current);

  const save = () => {
    setError(null);
    const backendData = toBackendModel(local);
    mutation.mutate(
      { reminders: backendData },
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

      if (strategy === 'custom' && prev.strategy !== 'custom') {
        // Hydrate custom with previous strategy settings to avoid starting blank
        const baseStrategy = prev.strategy;
        const beforeDays =
          baseStrategy === 'gentle'
            ? GENTLE_BEFORE
            : baseStrategy === 'aggressive'
            ? AGGRESSIVE_BEFORE
            : STANDARD_BEFORE;
        const afterDays =
          baseStrategy === 'gentle'
            ? GENTLE_AFTER
            : baseStrategy === 'aggressive'
            ? AGGRESSIVE_AFTER
            : STANDARD_AFTER;

        nextBefore = [...beforeDays];
        nextAfter = [...afterDays];
      }

      return {
        ...prev,
        strategy,
        customBeforeDueDays: nextBefore,
        customAfterDueDays: nextAfter,
      };
    });

    // Auto-update active timeline preview event to match new strategy
    if (strategy === 'gentle') {
      setActivePreviewEvent({ id: 'before-2', type: 'before', days: 2, channel: 'whatsapp' });
    } else if (strategy === 'standard') {
      setActivePreviewEvent({ id: 'before-3', type: 'before', days: 3, channel: 'whatsapp' });
    } else if (strategy === 'aggressive') {
      setActivePreviewEvent({ id: 'before-5', type: 'before', days: 5, channel: 'whatsapp' });
    } else {
      setActivePreviewEvent({ id: 'due', type: 'due', days: 0, channel: 'whatsapp' });
    }
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
          sub: `Payment reminder with late fee warning`,
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
        sub: `Continuous alerts until full payment is made`,
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
      // Estimate 30 days overdue window
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
        return <MessageCircle className="w-4 h-4 text-emerald-500" />;
      case 'email':
        return <Mail className="w-4 h-4 text-indigo-500" />;
      case 'in_app':
        return <Smartphone className="w-4 h-4 text-blue-500" />;
    }
  };

  // Mock message content template builder
  const getPreviewMessageText = (
    type: 'before' | 'due' | 'after' | 'repeat',
    days: number,
    channel: 'whatsapp' | 'email' | 'in_app'
  ) => {
    if (channel === 'whatsapp') {
      if (type === 'before') {
        return `Hi Rahul,\n\nYour rent of *₹8,500* for *Room 204* is due in ${days} days (on July 5). Kindly make the payment online or via UPI to ensure a seamless stay.\n\n👉 Click here to pay: hms.tenant/pay/july`;
      }
      if (type === 'due') {
        return `Hi Rahul,\n\nToday is the due date for your rent of *₹8,500*. Please clear the dues today to avoid any late payment charges.\n\n👉 Click here to pay: hms.tenant/pay/july`;
      }
      if (type === 'after') {
        return `⚠️ *Rent Overdue Alert* ⚠️\n\nHi Rahul, your rent of *₹8,500* was due on July 5. It is now *${days} day${
          days > 1 ? 's' : ''
        } overdue*. A late fee may be added to your balance.\n\n👉 Clear your balance now: hms.tenant/pay/july`;
      }
      return `⚠️ *Rent Collection Follow-up* ⚠️\n\nHi Rahul, this is a recurring reminder that your rent of *₹8,500* remains unpaid. Please clear it immediately to prevent hostel services disruption.\n\n👉 Pay online: hms.tenant/pay/july`;
    }

    if (channel === 'in_app') {
      if (type === 'before') {
        return `Rent Payment Upcoming: ₹8,500 due in ${days} days.`;
      }
      if (type === 'due') {
        return `Rent Due Today: Please clear your ₹8,500 rent obligation.`;
      }
      if (type === 'after') {
        return `Rent Overdue: Your rent of ₹8,500 is ${days} day${days > 1 ? 's' : ''} past due.`;
      }
      return `Urgent Reminder: Outstanding rent balance of ₹8,500.`;
    }

    // Email
    if (type === 'before') {
      return `Subject: Invoice Upcoming - Rent due in ${days} days\n\nDear Rahul,\n\nThis is a friendly reminder that your rent invoice for Room 204 is due in ${days} days. Please clear it by July 5.`;
    }
    if (type === 'due') {
      return `Subject: Rent Due Today - Room 204\n\nDear Rahul,\n\nThis is to notify you that your rent invoice of ₹8,500 is due today. Please make the payment to avoid late fees.`;
    }
    if (type === 'after') {
      return `Subject: URGENT: Rent Overdue by ${days} Days\n\nDear Rahul,\n\nYour rent payment is currently ${days} day${
        days > 1 ? 's' : ''
      } overdue. A late fee rule has been triggered. Please clear immediately.`;
    }
    return `Subject: Final Demand: Outstanding Rent Balance\n\nDear Rahul,\n\nThis is a recurring follow-up notice regarding your unpaid rent balance of ₹8,500. Please clear it today.`;
  };

  // Determine active channels list to loop over in preview tabs
  const getActiveChannels = () => {
    const active: Array<'whatsapp' | 'in_app' | 'email'> = [];
    if (local.channels.whatsapp) active.push('whatsapp');
    if (local.channels.in_app) active.push('in_app');
    if (local.channels.email) active.push('email');
    if (active.length === 0) active.push('whatsapp'); // Fallback preview
    return active;
  };

  const activeChannelsList = getActiveChannels();

  // Make sure current preview channel is valid based on selected channels
  useEffect(() => {
    if (!activeChannelsList.includes(activePreviewEvent.channel)) {
      setActivePreviewEvent((prev) => ({
        ...prev,
        channel: activeChannelsList[0],
      }));
    }
  }, [local.channels]);

  return (
    <SectionShell
      title="Rent Collection Automation"
      description="Choose a collection strategy, enabled notification channels, and preview the tenant message sequence."
      isDirty={isDirty}
      saving={mutation.isPending}
      onSave={save}
      onReset={handleReset}
      error={error}
    >
      <div className="space-y-8">
        {/* Step 1: Collection Strategy Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              1. Collection Strategy
            </h3>
          </div>
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
              <h4 className="font-semibold text-sm text-foreground mb-1">Gentle</h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                Friendly reminders, low frequency. Perfect for high-trust tenants.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                2d before • Due • 1d, 7d overdue
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
              {/* Recommended Badge */}
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
              <h4 className="font-semibold text-sm text-foreground mb-1">Standard</h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                Balanced strategy. Proven to collect 90%+ of rent obligations on time.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                3d, 1d before • Due • 1d, 5d, 10d overdue
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
              <h4 className="font-semibold text-sm text-foreground mb-1">Aggressive</h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                High frequency follow-ups. Designed for persistent late payers.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                5d, 3d, 1d before • Due • Daily to 14d overdue
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
              <h4 className="font-semibold text-sm text-foreground mb-1">Custom</h4>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                Create a tailored reminder timeline suited to your specific needs.
              </p>
              <div className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                Customizable timing & interval
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Channels Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            2. Channels
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WhatsApp Card */}
            <div
              onClick={() => toggleChannel('whatsapp')}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                local.channels.whatsapp
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border bg-card hover:border-border-hover'
              }`}
            >
              <div className={`p-2 rounded-lg ${local.channels.whatsapp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-secondary text-muted-foreground'}`}>
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">WhatsApp</span>
                  <Toggle checked={local.channels.whatsapp} onChange={() => {}} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  High visibility messages sent directly to tenant WhatsApp numbers.
                </p>
              </div>
            </div>

            {/* In-App push */}
            <div
              onClick={() => toggleChannel('in_app')}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                local.channels.in_app
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-border bg-card hover:border-border-hover'
              }`}
            >
              <div className={`p-2 rounded-lg ${local.channels.in_app ? 'bg-blue-500/10 text-blue-600' : 'bg-secondary text-muted-foreground'}`}>
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Tenant App</span>
                  <Toggle checked={local.channels.in_app} onChange={() => {}} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Push notifications and dashboard highlights inside tenant portal.
                </p>
              </div>
            </div>

            {/* Email Card */}
            <div
              onClick={() => toggleChannel('email')}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                local.channels.email
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : 'border-border bg-card hover:border-border-hover'
              }`}
            >
              <div className={`p-2 rounded-lg ${local.channels.email ? 'bg-indigo-500/10 text-indigo-600' : 'bg-secondary text-muted-foreground'}`}>
                <Mail className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Email Notifications</span>
                  <Toggle checked={local.channels.email} onChange={() => {}} />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Professional digital invoice reminders and payment links via email.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Interactive Sandbox (Timeline + Tenant Mockup) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-border pt-8">
          {/* Timeline - Left Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Automation Sequence Timeline</h3>
                <p className="text-xs text-muted-foreground">
                  Simulating a typical billing cycle with Rent Due Date on **July 5**
                </p>
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-200/50">
                ~{getEstimatedReminderCount()} notifications total
              </span>
            </div>

            <div className="relative border-l border-border pl-6 space-y-6 ml-3 mt-4">
              {timelineEvents.map((evt) => {
                const isActive = activePreviewEvent.id === evt.id;
                const isDue = evt.type === 'due';
                const isRepeat = evt.type === 'repeat';

                return (
                  <div
                    key={evt.id}
                    onClick={() =>
                      setActivePreviewEvent({
                        id: evt.id,
                        type: evt.type,
                        days: evt.days,
                        channel: activePreviewEvent.channel,
                      })
                    }
                    className={`relative p-3 rounded-lg border cursor-pointer select-none transition-all ${
                      isActive
                        ? 'border-accent bg-accent/5 ring-1 ring-accent'
                        : 'border-transparent bg-transparent hover:bg-secondary/40'
                    }`}
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute -left-[31px] top-4 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isDue
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : isRepeat
                          ? 'bg-purple-500 border-purple-500 text-white'
                          : isActive
                          ? 'bg-accent border-accent text-white'
                          : 'bg-background border-border text-muted-foreground'
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {evt.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                            {evt.dateStr}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{evt.sub}</p>
                      </div>

                      {/* Enabled Channels Badge */}
                      <div className="flex gap-1">
                        {isDue ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200/30">
                            Milestone
                          </span>
                        ) : (
                          activeChannelsList.map((ch) => (
                            <span
                              key={ch}
                              className="p-1 bg-secondary hover:bg-secondary-hover rounded transition-colors"
                              title={`Sent via ${ch}`}
                            >
                              {getChannelIcon(ch)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Device Mockup Preview - Right Column */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-accent" /> Tenant Message Preview
              </h3>
              <p className="text-xs text-muted-foreground">
                See exactly what Rahul receives on his device.
              </p>
            </div>

            {/* Channels Switch inside Sandbox */}
            <div className="flex border-b border-border">
              {activeChannelsList.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() =>
                    setActivePreviewEvent((prev) => ({
                      ...prev,
                      channel: ch,
                    }))
                  }
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 capitalize ${
                    activePreviewEvent.channel === ch
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {getChannelIcon(ch)}
                  {ch === 'in_app' ? 'In-App' : ch}
                </button>
              ))}
            </div>

            {/* Device Canvas */}
            <div className="flex-1 bg-secondary/50 border border-border rounded-xl p-4 flex items-center justify-center min-h-[340px]">
              {activePreviewEvent.channel === 'whatsapp' ? (
                // WhatsApp Phone Mockup
                <div className="w-full max-w-[280px] bg-background border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col">
                  {/* WhatsApp Header */}
                  <div className="bg-[#075e54] text-white px-4 py-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                      H
                    </div>
                    <div>
                      <div className="text-[11px] font-bold">HMS Collections</div>
                      <div className="text-[8px] opacity-75">Business Account</div>
                    </div>
                  </div>
                  {/* WhatsApp Chat Area */}
                  <div className="bg-[#efeae2] dark:bg-slate-900 flex-1 p-3 flex flex-col justify-end min-h-[220px]">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm text-xs text-foreground max-w-[85%] relative self-start">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {getPreviewMessageText(
                          activePreviewEvent.type,
                          activePreviewEvent.days,
                          'whatsapp'
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground text-right mt-1.5">
                        10:00 AM
                      </div>
                    </div>
                  </div>
                </div>
              ) : activePreviewEvent.channel === 'in_app' ? (
                // In-App Alert Mockup
                <div className="w-full max-w-[280px] bg-background border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col">
                  {/* Status Bar */}
                  <div className="bg-secondary px-4 py-2 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                    <span>10:00 AM</span>
                    <div className="flex gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 space-y-4">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                        H
                      </div>
                      <span className="font-bold text-xs">HMS Tenant Portal</span>
                    </div>

                    {/* Notification card inside app */}
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-start gap-3">
                      <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-foreground">Rent Payment Alert</div>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          {getPreviewMessageText(
                            activePreviewEvent.type,
                            activePreviewEvent.days,
                            'in_app'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Email Mockup
                <div className="w-full max-w-[320px] bg-background border border-border rounded-xl shadow-lg overflow-hidden flex flex-col">
                  {/* Email Header */}
                  <div className="bg-secondary px-3 py-2 border-b border-border text-[10px] text-muted-foreground space-y-0.5">
                    <div>
                      <span className="font-semibold text-foreground">From:</span> invoices@hostelmanagement.com
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">To:</span> rahul.sharma@domain.com
                    </div>
                  </div>
                  {/* Email Body */}
                  <div className="p-4 flex-1 text-xs text-foreground space-y-3 font-sans">
                    <div className="whitespace-pre-wrap leading-relaxed bg-secondary/30 p-2.5 rounded border border-border/50">
                      {getPreviewMessageText(
                        activePreviewEvent.type,
                        activePreviewEvent.days,
                        'email'
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 4: Advanced Custom Accordion */}
        {local.strategy === 'custom' && (
          <div className="border border-border rounded-xl overflow-hidden mt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-4 bg-secondary/30 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-500" />
                <div>
                  <span className="font-semibold text-sm text-foreground">Advanced Schedule Configuration</span>
                  <p className="text-xs text-muted-foreground">Customize exact timings and intervals.</p>
                </div>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-5 border-t border-border bg-card space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Before Due Days Picker */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Before Due Date (Days)
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
                              : 'border-border text-muted-foreground hover:border-border-hover'
                          }`}
                        >
                          {day} Day{day > 1 ? 's' : ''} Before
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* After Due Days Picker */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    After Due Date (Days Overdue)
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
                              : 'border-border text-muted-foreground hover:border-border-hover'
                          }`}
                        >
                          {day} Day{day > 1 ? 's' : ''} Overdue
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Repeat Behaviour */}
                <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Repeat Behaviour
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Enable continuous reminders after the due date has passed.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Continue reminding every</span>
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
                    <span className="text-xs text-muted-foreground">until payment is received</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Stop Conditions & Behaviour */}
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

        {/* Step 6: Escalation Policy (Roadmap block) */}
        <div className="border-t border-border pt-6 opacity-60">
          <div className="flex items-start gap-4 p-4 rounded-xl border border-dashed border-border bg-secondary/10">
            <div className="p-2 bg-secondary text-muted-foreground rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  4. Escalation Policy
                </span>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded border border-indigo-200/30">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Escalate persistent unpaid balances to tenant guardians automatically via SMS or WhatsApp templates.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" disabled checked className="rounded border-border text-accent" />
                <span className="text-xs text-muted-foreground">
                  Auto-alert guardian if balance is unpaid for 15 days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
