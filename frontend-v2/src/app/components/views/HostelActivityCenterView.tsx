import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, CreditCard, Receipt, Users, FileText, Settings, ArrowRightLeft,
  AlertCircle, Phone, CheckCircle2, ExternalLink, Calendar, Plus,
  ChevronDown, ChevronUp, Bell, Loader2, IndianRupee, Building2, HelpCircle
} from 'lucide-react';
import api from '@lib/api-client';
import { queryKeys } from '@lib/queryKeys';
import { ownerService } from '@features/owners/api';
import { RecordPaymentModal } from '../modals/RecordPaymentModal';

// WhatsApp Icon component
function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.248 5.31 0 11.779 0c3.136.001 6.086 1.222 8.31 3.448 2.223 2.225 3.443 5.177 3.44 8.31-.005 6.545-5.253 11.793-11.722 11.793-1.996-.001-3.957-.509-5.698-1.474L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.451 5.378 0 9.756-4.379 9.76-9.761.002-2.607-1.01-5.059-2.85-6.902C16.452 2.097 13.997 1.08 11.391 1.08c-5.385 0-9.766 4.381-9.77 9.763-.001 1.624.42 3.208 1.22 4.61L1.82 21.848l6.09-1.597zM17.06 13.9c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-2.63-1.1-4.22-2.45-5.07-3.92-.22-.38.22-.35.63-1.16.08-.15.04-.28-.02-.43-.06-.15-.48-1.16-.66-1.59-.17-.42-.35-.36-.48-.37l-.4-.01c-.15 0-.4.06-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.9 2.3c.12.15 1.58 2.41 3.83 3.38 2.25.97 2.25.65 2.65.61.4-.04 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.21-.58-.36z"/>
    </svg>
  );
}

interface HostelActivityCenterViewProps {
  hostelId: string;
}

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'occupancy', label: 'Occupancy', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'admissions', label: 'Admissions', icon: Plus },
  { id: 'move outs', label: 'Move Outs', icon: ArrowRightLeft },
  { id: 'billing', label: 'Billing', icon: IndianRupee },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function HostelActivityCenterView({ hostelId }: HostelActivityCenterViewProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [recordPayment, setRecordPayment] = useState<{ hostelId: string; dueId?: string; amount?: string } | null>(null);

  // Fetch hostel details for header context
  const { data: hostelsData } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as any)?.hostels)
    ? (hostelsData as any).hostels
    : [];

  const hostel = hostels.find((h: any) => String(h.id) === hostelId);
  const hostelCode = hostel ? (hostel.code || hostel.name.substring(0, 5).toUpperCase()) : 'Hostel';

  // Fetch unified activity logs, summary stats, and needs attention details
  const { data: activityData, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner', 'activity-logs-unified', hostelId, activeCategory, searchQuery],
    queryFn: async () => {
      const response = await api.get('/owner/activity-logs', {
        params: {
          hostelId,
          category: activeCategory !== 'all' ? activeCategory : undefined,
          search: searchQuery || undefined,
          limit: 100,
          offset: 0
        }
      });
      return response.data;
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true
  });

  const events = activityData?.items || [];
  const todaySummary = activityData?.todaySummary || { payments: 0, expenses: 0, moveouts: 0, pendingActions: 0 };
  const needsAttention = activityData?.needsAttention || {
    overdueTenants: [],
    vacantBeds: { count: 0, rooms: [] },
    pendingDocs: [],
    pendingMoveOuts: []
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatKeyName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const formatValue = (key: string, val: any) => {
    if (val === null || val === undefined) return '—';
    if (key.includes('amount') || key === 'amount' || key.includes('cash') || key.includes('cost') || key.includes('fee')) {
      return formatCurrency(Number(val));
    }
    if (key.includes('date') || key.includes('timestamp') || key.includes('at')) {
      return new Date(val).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return String(val);
  };

  // Helper to resolve card background/text colors for badges
  const getBadgeColors = (category: string) => {
    switch (category.toLowerCase()) {
      case 'payments':
        return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-100 dark:border-emerald-500/20', icon: CreditCard };
      case 'expenses':
        return { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-100 dark:border-rose-500/20', icon: Receipt };
      case 'occupancy':
        return { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-100 dark:border-blue-500/20', icon: Users };
      case 'documents':
        return { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-100 dark:border-amber-500/20', icon: FileText };
      case 'admissions':
        return { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-100 dark:border-sky-500/20', icon: Plus };
      case 'move outs':
        return { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-100 dark:border-purple-500/20', icon: ArrowRightLeft };
      case 'billing':
        return { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-100 dark:border-indigo-500/20', icon: IndianRupee };
      default:
        return { bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-100 dark:border-slate-500/20', icon: Settings };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{hostelCode} Activity Center</h1>
        <p className="text-sm font-medium text-muted-foreground mt-1">
          Everything happening inside this hostel.
        </p>
      </div>

      {/* 2. Today Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Payments</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(todaySummary.payments)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">Collected today</span>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Expenses</span>
          <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-2">
            {formatCurrency(todaySummary.expenses)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">Spent today</span>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Move-Outs</span>
          <span className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2">
            {todaySummary.moveouts}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">Completed exits</span>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Actions</span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-2">
            {todaySummary.pendingActions}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">Needs Attention items</span>
        </div>
      </div>

      {/* 3. Filter Chips & Search Bar */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORY_CHIPS.map(chip => {
            const Icon = chip.icon;
            const isActive = activeCategory === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveCategory(chip.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all shrink-0 touch-manipulation ${
                  isActive
                    ? 'bg-accent text-accent-foreground border-transparent shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:bg-secondary/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events by tenant name, room number, or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* 4. Combined Layout: Feed & Needs Attention Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Activity timeline Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Timeline Feed</h2>
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              Refresh Feed
            </button>
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 h-24 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 bg-card border border-border rounded-2xl">
              <AlertCircle className="w-8 h-8 text-destructive animate-bounce" />
              <p className="text-sm font-medium text-muted-foreground">Failed to load activity feed</p>
              <button
                onClick={() => refetch()}
                className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card border border-border rounded-2xl">
              <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">No activity events found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                  Try clearing search query, picking another category filter, or check back later.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isError && events.length > 0 && (
            <div className="space-y-3">
              {events.map((e: any) => {
                const badge = getBadgeColors(e.category);
                const CardIcon = badge.icon;
                const isExpanded = !!expandedCards[e.id];

                return (
                  <div
                    key={e.id}
                    className="bg-card border border-border hover:border-accent/30 rounded-2xl shadow-sm transition-all overflow-hidden"
                  >
                    {/* Collapsed Header Bar */}
                    <div
                      onClick={() => toggleExpand(e.id)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none touch-manipulation hover:bg-secondary/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Color-coded Category Badge */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badge.bg} ${badge.text} ${badge.border}`}>
                          <CardIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate">{e.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 font-medium truncate">{e.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content Accordion */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-border bg-secondary/5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {Object.entries(e.metadata || {})
                            // Filter out keys containing UUIDs, IDs or URLs to keep it non-technical
                            .filter(([k, v]) => !k.includes('id') && !k.includes('_id') && !k.includes('url') && !k.includes('path') && k !== 'receipt_url')
                            .map(([key, val]) => (
                              <div key={key} className="flex justify-between sm:justify-start gap-4 py-1 border-b border-border/50">
                                <span className="text-muted-foreground font-medium w-32 shrink-0">{formatKeyName(key)}:</span>
                                <span className="font-semibold text-foreground text-right sm:text-left">{formatValue(key, val)}</span>
                              </div>
                            ))}
                        </div>

                        {/* Optional action buttons inside accordion */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                          {e.metadata.receipt_url && (
                            <a
                              href={e.metadata.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Receipt
                            </a>
                          )}
                          <span className="text-[10px] text-muted-foreground italic ml-auto">
                            Logged: {new Date(e.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Sticky "Needs Attention" Panel */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Needs Attention</h2>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Vacant Beds Stat */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vacant Beds</span>
                <span className="text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  {needsAttention.vacantBeds.count} Empty
                </span>
              </div>
              {needsAttention.vacantBeds.count > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Rooms with empty beds:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {needsAttention.vacantBeds.rooms.map((room: any) => (
                      <span
                        key={room.roomId}
                        className="text-[10px] font-bold bg-secondary border border-border px-2 py-1 rounded-lg"
                      >
                        Room {room.roomNo}: {room.vacantBeds} bed{room.vacantBeds > 1 ? 's' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Hostel is currently 100% full.</p>
              )}
            </div>

            {/* Overdue Tenants */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Overdue Tenants</span>
                <span className="text-xs font-extrabold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
                  {needsAttention.overdueTenants.length} Dues
                </span>
              </div>
              {needsAttention.overdueTenants.length > 0 ? (
                <div className="space-y-2.5 divide-y divide-border">
                  {needsAttention.overdueTenants.map((tenant: any) => {
                    const telPhone = tenant.phone ? tenant.phone.replace(/[^\d+]/g, '') : null;
                    let whatsappUrl = null;
                    if (tenant.phone) {
                      let clean = tenant.phone.replace(/[^\d]/g, '');
                      if (clean.length === 10) clean = '91' + clean;
                      const msg = `Hi ${tenant.name}, a friendly reminder regarding your outstanding rent of ${formatCurrency(tenant.amountOverdue)} at ${hostel?.name || 'Sri Adithya Boys Hostel'}. Please clear it at your earliest convenience. Thank you!`;
                      whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
                    }

                    return (
                      <div key={tenant.tenantId} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground truncate">{tenant.name}</span>
                            <span className="text-[10px] text-muted-foreground">· Rm {tenant.roomNo}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-foreground">{formatCurrency(tenant.amountOverdue)}</span>
                            <span className="text-[10px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 px-1 rounded-md font-semibold">
                              {tenant.daysOverdue}d overdue
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {telPhone && (
                            <a
                              href={`tel:${telPhone}`}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >
                              <WhatsAppIcon />
                            </a>
                          )}
                          <button
                            onClick={() => setRecordPayment({
                              hostelId,
                              dueId: undefined,
                              amount: String(tenant.amountOverdue)
                            })}
                            className="text-[10px] font-bold bg-accent text-accent-foreground px-2.5 py-1 rounded-lg hover:opacity-90"
                          >
                            Pay
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No outstanding overdue rent obligations.</p>
              )}
            </div>

            {/* Pending Documents */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Documents</span>
                <span className="text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  {needsAttention.pendingDocs.length} Docs
                </span>
              </div>
              {needsAttention.pendingDocs.length > 0 ? (
                <div className="space-y-2.5 divide-y divide-border">
                  {needsAttention.pendingDocs.map((doc: any) => (
                    <div key={doc.docId} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">{doc.name}</span>
                          <span className="text-[10px] text-muted-foreground">· Rm {doc.roomNo}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Doc: <span className="font-semibold text-amber-600 dark:text-amber-400">{doc.docType}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/hostels/${hostelId}/tenants/${doc.tenantId}?tab=documents`)}
                        className="text-[10px] font-bold bg-accent text-accent-foreground px-2.5 py-1 rounded-lg hover:opacity-90 shrink-0"
                      >
                        Verify
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All uploaded documents verified.</p>
              )}
            </div>

            {/* Pending Move-Outs */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Pending Move-outs</span>
                <span className="text-xs font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">
                  {needsAttention.pendingMoveOuts.length} Exits
                </span>
              </div>
              {needsAttention.pendingMoveOuts.length > 0 ? (
                <div className="space-y-2.5 divide-y divide-border">
                  {needsAttention.pendingMoveOuts.map((req: any) => (
                    <div key={req.requestId} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">{req.name}</span>
                          <span className="text-[10px] text-muted-foreground">· Rm {req.roomNo}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Exit: {new Date(req.plannedExitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
                        className="text-[10px] font-bold bg-accent text-accent-foreground px-2.5 py-1 rounded-lg hover:opacity-90 shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No active move-out requests.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {recordPayment && (
        <RecordPaymentModal
          hostelId={recordPayment.hostelId}
          initialDueId={recordPayment.dueId}
          initialAmount={recordPayment.amount}
          onClose={() => setRecordPayment(null)}
        />
      )}
    </div>
  );
}
