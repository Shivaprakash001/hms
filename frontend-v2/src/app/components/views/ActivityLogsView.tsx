import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Calendar, ChevronDown, ChevronUp, Search, Activity, Clock,
  Plus, Edit, Trash2, IndianRupee, AlertCircle, User, ArrowRightLeft,
  Settings, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { ownerService } from '@features/owners/api';
import api from '@lib/api-client';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Creations' },
  { value: 'UPDATE', label: 'Updates' },
  { value: 'DELETE', label: 'Deletions' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'ALLOCATE', label: 'Allocations' },
  { value: 'TRANSFER', label: 'Transfers' },
  { value: 'STATUS_CHANGE', label: 'Status Changes' },
  { value: 'WAIVE', label: 'Rent Waived' },
  { value: 'GENERATE', label: 'Rent Generated' },
];

const TIME_RANGES = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

function formatCurrency(v: number) {
  return `₹${v.toLocaleString('en-IN')}`;
}

export function ActivityLogsView() {
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [showHostelPicker, setShowHostelPicker] = useState(false);

  const [selectedAction, setSelectedAction] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
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

  const { startDate, endDate } = getDates();

  // Fetch activity logs
  const { data: logsData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'owner', 'activity-logs',
      selectedHostelId, selectedAction, timeRange, startDate, endDate, searchQuery, page
    ],
    queryFn: async () => {
      const response = await api.get('/owner/activity-logs', {
        params: {
          hostelId: selectedHostelId || undefined,
          actionType: selectedAction || undefined,
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
      IconComponent = Trash2; // Represents spending
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
      title = 'Hostel Rules Updated';
      description = `Updated rules for domains: ${Array.isArray(meta.changed_domains) ? meta.changed_domains.join(', ') : 'settings'} (v${meta.policy_version || 1})`;
      iconColor = 'text-purple-500 bg-purple-500/10';
    }

    return { title, description, IconComponent, iconColor };
  };

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View history of all management updates and operational changes.
          </p>
        </div>

        {/* Hostel Context Picker */}
        <div className="relative shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setShowHostelPicker((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-foreground shadow-sm hover:bg-secondary/40 transition-colors"
          >
            <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-[140px]">{activeHostel ? String(activeHostel.name) : 'All Hostels'}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          </button>
          {showHostelPicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowHostelPicker(false)} />
              <div className="absolute right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-xl z-40 min-w-[200px] overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => { setSelectedHostelId(''); setShowHostelPicker(false); setPage(0); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    selectedHostelId === '' ? 'bg-accent/10 text-accent font-semibold' : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  All Hostels
                </button>
                {hostels.map((h: any) => (
                  <button
                    key={String(h.id)}
                    onClick={() => { setSelectedHostelId(String(h.id)); setShowHostelPicker(false); setPage(0); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
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
      </div>

      {/* Control Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Action Type</label>
            <div className="relative">
              <select
                value={selectedAction}
                onChange={(e) => { setSelectedAction(e.target.value); setPage(0); }}
                className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Time Duration Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time Period</label>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => { setTimeRange(e.target.value); setPage(0); }}
                className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Search bar */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Search Logs</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Search actor, details..."
                className="w-full text-xs font-medium bg-secondary/30 border border-border rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent placeholder-muted-foreground"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Custom Date Inputs */}
        {timeRange === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border animate-in fade-in slide-in-from-top-1 duration-150">
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
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
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
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-2xl bg-card/40">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Showing {logs.length} of {total} events</span>
          </div>

          <div className="space-y-3">
            {logs.map((log: any) => {
              const { title, description, IconComponent, iconColor } = getEventMeta(log);
              const isExpanded = expandedLogId === log.id;
              const timestamp = new Date(log.timestamp);
              const timeFormatted = timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const dateFormatted = timestamp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

              return (
                <div key={log.id} className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-center gap-3 p-4 cursor-pointer select-none"
                  >
                    {/* Action Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${iconColor}`}>
                      <IconComponent className="w-5 h-5 shrink-0" />
                    </div>

                    {/* Timeline Event Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-semibold text-foreground text-sm truncate">{title}</h4>
                        <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{dateFormatted} · {timeFormatted}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
                      
                      {/* Actor & Hostel context tags */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] bg-secondary/60 text-foreground font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {log.actor.name || 'System'}
                        </span>
                        {log.hostel_name && (
                          <span className="text-[10px] bg-secondary/60 text-foreground font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {log.hostel_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron toggler */}
                    <div className="shrink-0 text-muted-foreground/60 p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border bg-secondary/10 rounded-b-2xl animate-in slide-in-from-top-1 duration-150">
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Event Details & Metadata</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card border border-border rounded-xl p-3 shadow-inner">
                          <div className="space-y-1">
                            <span className="text-muted-foreground">Action Type:</span>
                            <span className="font-semibold text-foreground ml-1.5">{log.action_type}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground">Entity Type:</span>
                            <span className="font-semibold text-foreground ml-1.5">{log.entity_type}</span>
                          </div>
                          {log.entity_id && (
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-muted-foreground">Entity Reference ID:</span>
                              <span className="font-mono text-foreground ml-1.5 break-all select-all">{log.entity_id}</span>
                            </div>
                          )}
                          <div className="space-y-1 sm:col-span-2">
                            <span className="text-muted-foreground">Actor Email:</span>
                            <span className="font-semibold text-foreground ml-1.5">{log.actor.email || 'System'}</span>
                          </div>
                        </div>

                        {/* Metadata JSON block */}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Raw Payload</div>
                            <pre className="text-[10px] font-mono bg-[#1E1E2E]/90 text-[#F8F8F2] p-3 rounded-xl overflow-x-auto shadow-md border border-border/20 leading-relaxed">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
