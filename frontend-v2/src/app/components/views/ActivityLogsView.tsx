import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Calendar, ChevronDown, ChevronUp, Search, Activity, Clock,
  Plus, Edit, Trash2, IndianRupee, AlertCircle, User, ArrowRightLeft,
  Settings, CheckCircle2, ChevronRight, X, Receipt
} from 'lucide-react';
import { ownerService } from '@features/owners/api';
import api from '@lib/api-client';

const TIME_RANGES = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

function formatCurrency(v: number) {
  return `₹${v.toLocaleString('en-IN')}`;
}

export interface ActivityLogsViewProps {
  embedded?: boolean;
}

const getSeverity = (log: any) => {
  const entity = log.entity_type;
  const action = log.action_type;
  
  if (action === 'DELETE') {
    return {
      label: 'Deletion',
      color: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
      dot: 'bg-rose-500 ring-rose-100 dark:ring-rose-950',
    };
  }
  if (entity === 'PAYMENT' || action === 'PAYMENT') {
    return {
      label: 'Payment',
      color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
      dot: 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950',
    };
  }
  if (entity === 'TENANT' || entity === 'ROOM' || entity === 'ROOM_ALLOCATION') {
    return {
      label: 'Allocation',
      color: 'text-blue-700 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
      dot: 'bg-blue-500 ring-blue-100 dark:ring-blue-950',
    };
  }
  if (entity === 'EXPENSE' || entity === 'RENT' || action === 'WAIVE' || action === 'GENERATE') {
    return {
      label: 'Expense',
      color: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
      dot: 'bg-amber-500 ring-amber-100 dark:ring-amber-950',
    };
  }
  return {
    label: 'Settings',
    color: 'text-purple-700 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
    dot: 'bg-purple-500 ring-purple-100 dark:ring-purple-950',
  };
};

const getSettingsLogMeta = (meta: any) => {
  const domains = Array.isArray(meta.changed_domains) ? meta.changed_domains : ['settings'];
  
  const DOMAIN_MAP: Record<string, { title: string; impact: string }> = {
    billing: {
      title: "Billing & Late Fee Rules",
      impact: "updates rent cycles, grace periods, late fee structures, deposits, and partial payment settings"
    },
    payments: {
      title: "Payment Gateway Credentials",
      impact: "updates UPI ID, PhonePe merchant integration details, or instructions for tenants"
    },
    reminders: {
      title: "Automated Reminders",
      impact: "updates schedules, WhatsApp/email channels, and late fee escalation policies"
    },
    receipts: {
      title: "Invoice & Receipt Formats",
      impact: "updates receipt prefixes, legal disclaimers, custom footer notes, and automated receipt emails"
    },
    branding: {
      title: "Branding & Support Contact",
      impact: "updates colors, custom hostel logo URL, registered legal name, and GST number"
    },
    tenant_rules: {
      title: "Tenant Onboarding Rules",
      impact: "updates emergency contact mandates, invite expiration windows, and profile fields"
    },
    room_rules: {
      title: "Room Allocation Policies",
      impact: "updates occupancy enforcement strictness, overbooking permissions, and transfer approval workflows"
    },
    automation: {
      title: "System Automation Settings",
      impact: "updates auto-rent generation triggers, auto-reminders, and nightly data reconciliation tasks"
    },
    dashboard: {
      title: "Dashboard Customization",
      impact: "updates occupancy threshold warnings, collection target rates, and default widget views"
    },
    notifications: {
      title: "Notification Settings",
      impact: "updates daily owner email summary settings and communication channels"
    },
    operations: {
      title: "Regional Operations Options",
      impact: "updates base currency, system timezone, time/date display formatting, and data retention policies"
    },
    settings: {
      title: "Hostel Settings Configuration",
      impact: "updates administrative preferences and system preferences"
    }
  };

  if (domains.length === 1) {
    const info = DOMAIN_MAP[domains[0]] || DOMAIN_MAP.settings;
    return {
      title: `${info.title} Updated`,
      description: `This change ${info.impact} for all new and existing transactions.`
    };
  } else {
    const titles = domains.map(d => DOMAIN_MAP[d]?.title || d).join(", ");
    return {
      title: "Hostel Policies Updated",
      description: `Updated multiple settings (${titles}) which will impact billing, operations, and automation.`
    };
  }
};

const formatActor = (actor: any) => {
  if (!actor || !actor.name) return 'System';
  const isOwner = actor.email === 'sriadithyahostels@gmail.com';
  return `${actor.name} (${isOwner ? 'Owner' : 'Staff'})`;
};

const formatActorShort = (actor: any) => {
  if (!actor || !actor.name) return 'System';
  return actor.name.split(' ')[0];
};

const groupLogsByDate = (logsList: any[]) => {
  const groups: { [key: string]: any[] } = {};
  const todayStr = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  logsList.forEach((log) => {
    const date = new Date(log.timestamp);
    let groupKey = '';
    if (date.toDateString() === todayStr) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterdayStr) {
      groupKey = 'Yesterday';
    } else {
      groupKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(log);
  });
  return groups;
};

const getDiffs = (metadata: any) => {
  if (!metadata) return [];
  const diffs: { label: string; prev: any; curr: any }[] = [];
  
  const pairs = [
    { prev: 'previous_rent', curr: 'rent', label: 'Rent' },
    { prev: 'previous_amount', curr: 'amount', label: 'Amount' },
    { prev: 'previous_status', curr: 'status', label: 'Status' },
    { prev: 'previous_room_no', curr: 'room_no', label: 'Room' },
    { prev: 'previous_capacity', curr: 'capacity', label: 'Capacity' },
  ];

  pairs.forEach(({ prev, curr, label }) => {
    if (metadata[prev] !== undefined && metadata[curr] !== undefined) {
      diffs.push({ label, prev: metadata[prev], curr: metadata[curr] });
    }
  });

  return diffs;
};

interface ActivityLogItemProps {
  log: any;
  getEventMeta: (log: any) => any;
}

function ActivityLogItem({ log, getEventMeta }: ActivityLogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { title, description, IconComponent, iconColor } = getEventMeta(log);
  const severity = getSeverity(log);
  const timestamp = new Date(log.timestamp);
  const timeFormatted = timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Generate dynamic subtitle/description for compact row
  const getCompactInfo = () => {
    const meta = log.metadata || {};
    if (log.entity_type === 'PAYMENT') {
      return `${formatCurrency(meta.amount || 0)} • ${meta.method || 'Cash'}`;
    }
    if (log.entity_type === 'EXPENSE') {
      return `"${meta.title || 'Expense'}" • ${formatCurrency(meta.amount || 0)}`;
    }
    if (log.entity_type === 'ROOM') {
      if (log.action_type === 'ALLOCATE') {
        return `${meta.name || 'Tenant'} → Room ${meta.room_no || 'Room'}`;
      }
      return `Room ${meta.room_no || 'Room'}`;
    }
    if (log.entity_type === 'TENANT') {
      if (log.action_type === 'TRANSFER') {
        return `${meta.name || 'Tenant'} → Room ${meta.room_no || 'Room'}`;
      }
      if (log.action_type === 'STATUS_CHANGE') {
        return `${meta.name || 'Tenant'} • ${meta.status || 'Changed'}`;
      }
      return `${meta.name || meta.email || 'Tenant'}`;
    }
    if (log.entity_type === 'HOSTEL_POLICY') {
      const domains = Array.isArray(meta.changed_domains) ? meta.changed_domains : ['settings'];
      const friendlyDomains = domains.map(d => {
        const DOMAIN_NAMES: Record<string, string> = {
          billing: "Billing & Late Fees",
          payments: "Payment Gateways",
          reminders: "Auto Reminders",
          receipts: "Invoice Formats",
          branding: "Branding & Contact",
          tenant_rules: "Tenant Onboarding",
          room_rules: "Room Allocations",
          automation: "System Automation",
          dashboard: "Dashboard Widgets",
          notifications: "Notification Channels",
          operations: "Operations Config"
        };
        return DOMAIN_NAMES[d] || d;
      });
      return `${friendlyDomains.join(', ')}`;
    }
    return description;
  };

  const compactInfo = getCompactInfo();
  const diffsList = getDiffs(log.metadata);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all relative">
      {/* Connector dot to timeline vertical line */}
      <div className={`absolute -left-[20.5px] top-[18px] w-2.5 h-2.5 rounded-full border-2 border-card ${severity.dot} ring-4 shrink-0 z-10`} />

      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between gap-3 p-3 cursor-pointer select-none text-xs"
      >
        {/* Action Icon + Label + Main Title/Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm ${iconColor}`}>
            <IconComponent className="w-3.5 h-3.5 shrink-0" />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none tracking-wide uppercase ${severity.color}`}>
              {severity.label}
            </span>
            <span className="font-semibold text-foreground">{title}</span>
            <span className="text-muted-foreground font-light">•</span>
            <span className="font-medium text-muted-foreground truncate">{compactInfo}</span>
          </div>
        </div>

        {/* Time and Actor & Chevron */}
        <div className="flex items-center gap-2.5 shrink-0 text-muted-foreground font-medium">
          <span className="hidden sm:inline">{timeFormatted} • {formatActorShort(log.actor)}</span>
          <span className="sm:hidden">{timeFormatted}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-3 border-t border-border bg-secondary/5 rounded-b-xl animate-in slide-in-from-top-1 duration-150">
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card border border-border rounded-xl p-3.5 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Activity</span>
                <span className="text-sm font-semibold text-foreground">{title}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Performed By</span>
                <span className="text-sm font-medium text-foreground">{formatActor(log.actor)}</span>
              </div>
              {log.hostel_name && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Hostel</span>
                  <span className="text-sm font-medium text-foreground">{log.hostel_name}</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Date & Time</span>
                <span className="text-sm font-medium text-foreground">
                  {timestamp.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>

              {Object.entries(log.metadata || {}).map(([key, val]: [string, any]) => {
                if (['id', 'uuid', 'entity_id', 'user_id', 'hostel_id', 'tenant_id', 'allocation_id', 'name', 'room_no', 'policy_version', 'previous_version', 'changed_domains'].includes(key)) return null;
                if (key.startsWith('previous_')) return null;
                if (typeof val === 'object') return null;
                
                let displayKey = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                let displayVal = String(val);

                if (key.includes('amount') || key === 'rent' || key === 'deposit' || key === 'paid') {
                  const num = Number(val);
                  if (!isNaN(num)) displayVal = formatCurrency(num);
                }
                
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">{displayKey}</span>
                    <span className="text-sm font-semibold text-foreground">{displayVal}</span>
                  </div>
                );
              })}

              {/* Diffs/Changes Block */}
              {diffsList.map((d, index) => {
                let displayPrev = String(d.prev);
                let displayCurr = String(d.curr);
                if (d.label === 'Rent' || d.label === 'Amount') {
                  displayPrev = formatCurrency(Number(d.prev));
                  displayCurr = formatCurrency(Number(d.curr));
                }
                return (
                  <div key={index} className="sm:col-span-2 border-l-2 border-accent/20 pl-3 py-1 bg-accent/5 rounded-r-lg">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{d.label} Changed</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-muted-foreground line-through decoration-muted-foreground/40">{displayPrev}</span>
                      <ArrowRightLeft className="w-3 h-3 text-accent shrink-0" />
                      <span className="text-xs font-bold text-accent">{displayCurr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivityLogsView({ embedded = false }: ActivityLogsViewProps) {
  const navigate = useNavigate();
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [showHostelPicker, setShowHostelPicker] = useState(false);

  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [page, setPage] = useState<number>(0);
  const limit = 20;

  // Fetch hostels for dropdown
  const { data: hostelsData } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray(hostelsData?.hostels)
    ? hostelsData.hostels
    : [];

  const activeHostel = hostels.find((h: any) => String(h.id) === selectedHostelId);

  // Compute dates based on time range
  const getDates = () => {
    if (timeRange === 'custom') {
      return {
        startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
        endDate: customEndDate ? new Date(customEndDate).toISOString() : undefined,
      };
    }
    const end = new Date();
    const start = new Date();
    if (timeRange === '24h') {
      start.setHours(start.getHours() - 24);
    } else if (timeRange === '7d') {
      start.setDate(start.getDate() - 7);
    } else if (timeRange === '30d') {
      start.setDate(start.getDate() - 30);
    }
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  // Fetch activity logs
  const { data: logsData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'owner', 'activity-logs',
      selectedHostelId, selectedAction, selectedEntity, timeRange, searchQuery, page,
      timeRange === 'custom' ? customStartDate : '',
      timeRange === 'custom' ? customEndDate : ''
    ],
    queryFn: async () => {
      const { startDate, endDate } = getDates();
      const response = await api.get('/owner/activity-logs', {
        params: {
          hostelId: selectedHostelId || undefined,
          actionType: selectedAction || undefined,
          entityType: selectedEntity || undefined,
          startDate,
          endDate,
          search: searchQuery || undefined,
          limit,
          offset: page * limit,
        },
      });
      return response.data;
    },
    staleTime: 10 * 1000,
  });

  const logs = logsData?.items || [];
  const total = logsData?.total || 0;
  const pageCount = Math.ceil(total / limit);

  // Helper to render event descriptive message and icon
  const getEventMeta = (log: any) => {
    const { action_type, entity_type, metadata } = log;
    const meta = metadata || {};

    let title = `${action_type} ${entity_type}`;
    let description = '';
    let IconComponent = Activity;
    let iconColor = 'text-muted-foreground bg-secondary/50';

    if (entity_type === 'TENANT') {
      IconComponent = User;
      if (action_type === 'CREATE') {
        title = 'Tenant Invited';
        description = `Sent onboarding invitation to ${meta.email || 'new tenant'}`;
        iconColor = 'text-blue-500 bg-blue-500/10';
      } else if (action_type === 'UPDATE') {
        title = 'Tenant Updated';
        description = `Updated details for ${meta.name || 'tenant'} (${meta.email || ''})`;
        iconColor = 'text-amber-500 bg-amber-500/10';
      } else if (action_type === 'TRANSFER') {
        title = 'Tenant Transferred';
        description = `Transferred tenant to a different room`;
        iconColor = 'text-purple-500 bg-purple-500/10';
      } else if (action_type === 'STATUS_CHANGE') {
        title = 'Tenant Status Changed';
        description = `Changed status to ${meta.status || 'Updated'}`;
        iconColor = 'text-teal-500 bg-teal-500/10';
      } else if (action_type === 'REACTIVATE') {
        title = 'Tenant Reactivated';
        description = `Successfully reactivated tenant account`;
        iconColor = 'text-emerald-500 bg-emerald-500/10';
      }
    } else if (entity_type === 'ROOM') {
      IconComponent = Building2;
      if (action_type === 'CREATE') {
        title = 'Room Created';
        description = `Added Room ${meta.room_no || ''} with capacity ${meta.capacity || 0}`;
        iconColor = 'text-emerald-500 bg-emerald-500/10';
      } else if (action_type === 'UPDATE') {
        title = 'Room Updated';
        description = `Updated Room ${meta.room_no || ''} details`;
        iconColor = 'text-amber-500 bg-amber-500/10';
      } else if (action_type === 'DELETE') {
        title = 'Room Deleted';
        description = `Permanently removed Room ${meta.room_no || ''}`;
        iconColor = 'text-destructive bg-destructive/10';
      } else if (action_type === 'ALLOCATE') {
        title = 'Room Allocated';
        description = `Assigned tenant to Room ${meta.room_no || 'Room'}`;
        iconColor = 'text-blue-500 bg-blue-500/10';
      }
    } else if (entity_type === 'EXPENSE') {
      IconComponent = Receipt;
      if (action_type === 'CREATE') {
        title = 'Expense Recorded';
        description = `Recorded expense "${meta.title || ''}" of ${formatCurrency(meta.amount || 0)}`;
        iconColor = 'text-emerald-500 bg-emerald-500/10';
      } else if (action_type === 'UPDATE') {
        title = 'Expense Updated';
        description = `Modified expense "${meta.title || ''}" (${formatCurrency(meta.amount || 0)})`;
        iconColor = 'text-amber-500 bg-amber-500/10';
      } else if (action_type === 'DELETE') {
        title = 'Expense Deleted';
        description = `Removed expense "${meta.title || ''}" of ${formatCurrency(meta.amount || 0)}`;
        iconColor = 'text-destructive bg-destructive/10';
      }
    } else if (entity_type === 'PAYMENT') {
      IconComponent = IndianRupee;
      title = 'Payment Received';
      description = `Recorded payment of ${formatCurrency(meta.amount || 0)} via ${meta.method || 'Cash'}`;
      iconColor = 'text-emerald-500 bg-emerald-500/10';
    } else if (entity_type === 'RENT') {
      IconComponent = IndianRupee;
      if (action_type === 'WAIVE') {
        title = 'Rent Waived';
        description = `Waived outstanding rent amount`;
        iconColor = 'text-teal-500 bg-teal-500/10';
      } else if (action_type === 'GENERATE') {
        title = 'Rent Generated';
        description = `Automatically generated rent invoice of ${formatCurrency(meta.amount || 0)}`;
        iconColor = 'text-blue-500 bg-blue-500/10';
      }
    } else if (entity_type === 'HOSTEL_POLICY') {
      IconComponent = Settings;
      const settingsMeta = getSettingsLogMeta(meta);
      title = settingsMeta.title;
      description = settingsMeta.description;
      iconColor = 'text-purple-500 bg-purple-500/10';
    }

    return { title, description, IconComponent, iconColor };
  };

  const QUICK_CHIPS = [
    { id: 'all', label: 'All Events' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'payments', label: 'Payments' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'room-changes', label: 'Room Changes' },
    { id: 'settings', label: 'Settings' },
  ];

  const getIsChipActive = (id: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (id === 'all') {
      return (
        timeRange === '7d' &&
        selectedEntity === '' &&
        selectedAction === '' &&
        searchQuery === ''
      );
    }
    if (id === 'today') {
      return timeRange === '24h' && selectedEntity === '' && selectedAction === '';
    }
    if (id === 'yesterday') {
      return (
        timeRange === 'custom' &&
        customStartDate === yesterdayStr &&
        customEndDate === yesterdayStr &&
        selectedEntity === '' &&
        selectedAction === ''
      );
    }
    if (id === 'payments') {
      return selectedEntity === 'PAYMENT';
    }
    if (id === 'expenses') {
      return selectedEntity === 'EXPENSE';
    }
    if (id === 'room-changes') {
      return selectedEntity === 'ROOM';
    }
    if (id === 'settings') {
      return selectedEntity === 'HOSTEL_POLICY';
    }
    return false;
  };

  const handleChipClick = (id: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    setPage(0);
    setSearchQuery('');
    setSelectedAction('');

    if (id === 'all') {
      setTimeRange('7d');
      setSelectedEntity('');
    } else if (id === 'today') {
      setTimeRange('24h');
      setSelectedEntity('');
    } else if (id === 'yesterday') {
      setTimeRange('custom');
      setCustomStartDate(yesterdayStr);
      setCustomEndDate(yesterdayStr);
      setSelectedEntity('');
    } else if (id === 'payments') {
      setTimeRange('7d');
      setSelectedEntity('PAYMENT');
    } else if (id === 'expenses') {
      setTimeRange('7d');
      setSelectedEntity('EXPENSE');
    } else if (id === 'room-changes') {
      setTimeRange('7d');
      setSelectedEntity('ROOM');
    } else if (id === 'settings') {
      setTimeRange('7d');
      setSelectedEntity('HOSTEL_POLICY');
    }
  };

  const getActiveChipId = () => {
    for (const chip of QUICK_CHIPS) {
      if (getIsChipActive(chip.id)) {
        return chip.id;
      }
    }
    return 'all';
  };

  const grouped = groupLogsByDate(logs);

  return (
    <div className={embedded ? 'space-y-4 min-w-0 max-w-5xl mx-auto' : 'px-4 py-5 space-y-4 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8'}>
      {/* Header */}
      {!embedded && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back to Settings
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">System Audit Trail</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                View history of all management updates and operational changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Filters - Mobile Select Dropdown */}
      <div className="sm:hidden relative w-full">
        <select
          value={getActiveChipId()}
          onChange={(e) => handleChipClick(e.target.value)}
          className="w-full text-xs font-semibold bg-card border border-border rounded-xl px-3.5 py-2.5 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {QUICK_CHIPS.map((chip) => (
            <option key={chip.id} value={chip.id}>
              {chip.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {/* Quick Filters - Desktop Chips */}
      <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto py-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {QUICK_CHIPS.map((chip) => {
          const isActive = getIsChipActive(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChipClick(chip.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-accent/15 border-accent text-accent shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Compact Search & Filter Control Bar */}
      <div className="flex flex-col sm:flex-row gap-2 bg-card border border-border rounded-xl p-2 shadow-sm">
        {/* Search logs input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Search rent, room, tenant..."
            className="w-full text-xs font-medium bg-secondary/20 border border-border rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent placeholder-muted-foreground"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        </div>

        {/* Secondary filters flex container */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Hostel Context Picker */}
          <div className="relative flex-1 sm:flex-initial sm:min-w-[150px]">
            <button
              onClick={() => setShowHostelPicker((v) => !v)}
              className="w-full flex items-center justify-between gap-1 px-3 py-2 bg-secondary/30 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate max-w-[100px]">{activeHostel ? String(activeHostel.name) : 'All Hostels'}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
            {showHostelPicker && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowHostelPicker(false)} />
                <div className="absolute right-0 left-0 sm:left-auto top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-40 min-w-[180px] overflow-hidden py-1">
                  <button
                    onClick={() => { setSelectedHostelId(''); setShowHostelPicker(false); setPage(0); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      selectedHostelId === '' ? 'bg-accent/10 text-accent font-semibold' : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    All Hostels
                  </button>
                  {hostels.map((h: any) => (
                    <button
                      key={String(h.id)}
                      onClick={() => { setSelectedHostelId(String(h.id)); setShowHostelPicker(false); setPage(0); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                        String(h.id) === selectedHostelId ? 'bg-accent/10 text-accent font-semibold' : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      {String(h.name)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Time period filter */}
          <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
            <select
              value={timeRange}
              onChange={(e) => { setTimeRange(e.target.value); setPage(0); }}
              className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-lg px-2 py-2 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {timeRange === 'custom' && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-card border border-border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Start Date</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => { setCustomStartDate(e.target.value); setPage(0); }}
              className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">End Date</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => { setCustomEndDate(e.target.value); setPage(0); }}
              className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-12 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-medium text-muted-foreground">Failed to load audit logs</p>
          <button onClick={() => refetch()} className="text-xs text-accent font-semibold bg-accent/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl bg-card/40">
          <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center max-w-sm">
            <p className="font-semibold text-foreground text-sm">No activity logs found</p>
            <p className="text-xs text-muted-foreground mt-1">Try relaxing filters or search terms.</p>
          </div>
        </div>
      )}

      {/* Audit Log Timeline */}
      {!isLoading && !isError && logs.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Showing {logs.length} of {total} events</span>
          </div>

          <div className="space-y-5">
            {Object.entries(grouped).map(([dateGroup, groupItems]) => (
              <div key={dateGroup} className="space-y-2.5">
                {/* Date Group Header */}
                <div className="flex items-center gap-2 px-1 py-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
                  <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">{dateGroup}</span>
                  <div className="h-px bg-border flex-1 ml-2" />
                </div>
                
                {/* Timeline Connection Line container */}
                <div className="space-y-2 relative pl-5 border-l border-border/70 ml-2.5">
                  {groupItems.map((log: any) => (
                    <ActivityLogItem
                      key={log.id}
                      log={log}
                      getEventMeta={getEventMeta}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3.5 py-1.5 bg-card border border-border text-xs font-semibold rounded-xl text-foreground disabled:opacity-50 hover:bg-secondary/40 transition-colors active:scale-95"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-muted-foreground">Page {page + 1} of {pageCount}</span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-1.5 bg-card border border-border text-xs font-semibold rounded-xl text-foreground disabled:opacity-50 hover:bg-secondary/40 transition-colors active:scale-95"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
