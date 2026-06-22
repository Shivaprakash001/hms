import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, 
  CalendarDays, 
  FileText, 
  Loader2, 
  ShieldAlert, 
  Plus, 
  Send, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Coins, 
  ArrowRight,
  RefreshCw,
  Users
} from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { agreementService } from '@features/agreements/api';
import { roomService, allocationService } from '@features/rooms/api';
import { hmsToast } from '@lib/toast';

type QueueFilter = 'all' | 'expiring' | 'expired' | 'overdue' | 'move_out';
type TabType = 'expiring' | 'offers';

function readHostels(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown>)?.hostels))
    return (obj.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  return [];
}

function fmtDate(value: unknown) {
  if (!value) return 'Not set';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stateLabel(state: string) {
  switch (state) {
    case 'EXPIRED_AND_RENT_OVERDUE': return 'Expired + Rent Overdue';
    case 'RENEWAL_OVERDUE_CRITICAL': return 'Overdue Critical';
    case 'RENEWAL_DECISION_PENDING': return 'Renewal Pending';
    case 'MOVE_OUT_IN_PROGRESS': return 'Move-out Conflict';
    case 'EXPIRING_SOON': return 'Expiring Soon';
    case 'RENEWAL_AVAILABLE': return 'Renewal Available';
    default: return state.replace(/_/g, ' ');
  }
}

function statusBadgeColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'SENT': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'ACCEPTED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'DECLINED': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'EXPIRED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'REVISED': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800';
  }
}

export function RenewalQueueView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('expiring');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [selectedHostelId, setSelectedHostelId] = useState('');
  
  // Modals state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);

  // Bulk form state
  const [bulkStrategy, setBulkStrategy] = useState<'FLAT' | 'PERCENTAGE' | 'ROOM_CATEGORY'>('FLAT');
  const [bulkDuration, setBulkDuration] = useState('11');
  const [bulkRent, setBulkRent] = useState('');
  const [bulkDeposit, setBulkDeposit] = useState('');
  const [bulkPercent, setBulkPercent] = useState('5');
  const [bulkCategoryRents, setBulkCategoryRents] = useState<Record<string, string>>({});
  const [bulkTitle, setBulkTitle] = useState('Renewal Campaign');

  // Single / Revise form state
  const [singleRent, setSingleRent] = useState('');
  const [singleDeposit, setSingleDeposit] = useState('');
  const [singleDuration, setSingleDuration] = useState('11');
  const [singleNotes, setSingleNotes] = useState('');
  const [offersFilter, setOffersFilter] = useState<string>('ALL');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [isShifting, setIsShifting] = useState(false);

  // Fetch hostels
  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });
  const hostels = readHostels(hostelsRaw);
  const hostelId = selectedHostelId || (hostels[0]?.id ? String(hostels[0].id) : '');

  // Fetch expiring stays queue
  const { data: queueData, isLoading: isQueueLoading, isError: isQueueError, refetch: refetchQueue } = useQuery({
    queryKey: ['agreements', 'renewal-queue', hostelId, filter],
    queryFn: () => agreementService.getRenewalQueue({ hostelId, filter }),
    enabled: Boolean(hostelId),
    staleTime: 30_000,
  });

  // Fetch renewal offers
  const { data: offersData, isLoading: isOffersLoading, isError: isOffersError, refetch: refetchOffers } = useQuery({
    queryKey: ['agreements', 'renewal-offers', hostelId],
    queryFn: () => agreementService.getRenewalOffers({ hostelId }),
    enabled: Boolean(hostelId) && activeTab === 'offers',
    staleTime: 30_000,
  });

  // Fetch all rooms in the hostel
  const { data: roomsRaw = [] } = useQuery({
    queryKey: ['rooms', 'list', hostelId],
    queryFn: () => roomService.getAll(hostelId),
    enabled: Boolean(hostelId),
    staleTime: 5 * 60_000,
  });
  const rooms = Array.isArray(roomsRaw) ? roomsRaw : [];
  const currentRoomId = selectedRow?.tenant?.room?.id || selectedRow?.tenant?.room_id || '';
  const availableRooms = useMemo(() => {
    return rooms.filter((r: any) => {
      const occupied = Number(r.occupied_count ?? 0);
      const capacity = Number(r.capacity ?? 1);
      return occupied < capacity || r.id === currentRoomId;
    });
  }, [rooms, currentRoomId]);

  const queueRows = Array.isArray(queueData?.renewals) ? queueData.renewals : [];
  const queueCounts = queueData?.counts || {};

  const offerRows = Array.isArray(offersData?.offers) ? offersData.offers : [];
  const pipelineCounts = offersData?.pipeline || {};

  const filteredOfferRows = useMemo(() => {
    if (offersFilter === 'ALL') return offerRows;
    return offerRows.filter((offer: any) => offer.pipeline_status === offersFilter);
  }, [offerRows, offersFilter]);

  const filters = useMemo(() => [
    ['all', `All ${queueCounts.total ?? 0}`],
    ['expiring', `Expiring ${queueCounts.expiring ?? 0}`],
    ['expired', `Expired ${queueCounts.expired ?? 0}`],
    ['overdue', `Overdue ${queueCounts.overdue ?? 0}`],
    ['move_out', `Move-out ${queueCounts.move_out ?? 0}`],
  ] as [QueueFilter, string][], [queueCounts]);

  // Extract unique room categories from queue to pre-fill the room category configuration options
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    queueRows.forEach((row: any) => {
      const type = row.tenant?.room?.room_type;
      if (type) cats.add(type);
    });
    return Array.from(cats);
  }, [queueRows]);

  // Mutations
  const generateSingleMutation = useMutation({
    mutationFn: ({ agreementId, data }: { agreementId: string; data: any }) => 
      agreementService.generateRenewalOffer(agreementId, data),
    onSuccess: () => {
      hmsToast.success('Renewal offer created successfully');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
      setShowSingleModal(false);
      setSelectedRow(null);
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to generate renewal offer'),
  });

  const generateBulkMutation = useMutation({
    mutationFn: (data: any) => agreementService.generateBulkRenewalOffers(data),
    onSuccess: (res: any) => {
      hmsToast.success(`Renewal campaign launched successfully! Generated ${res.offersGenerated} offers.`);
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
      setShowBulkModal(false);
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to launch renewal campaign'),
  });

  const sendOfferMutation = useMutation({
    mutationFn: (offerId: string) => agreementService.sendRenewalOffer(offerId),
    onSuccess: () => {
      hmsToast.success('Renewal offer sent to tenant');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to send renewal offer'),
  });

  const reviseOfferMutation = useMutation({
    mutationFn: ({ offerId, data }: { offerId: string; data: any }) => 
      agreementService.reviseRenewalOffer(offerId, data),
    onSuccess: () => {
      hmsToast.success('Renewal offer revised successfully');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
      setShowReviseModal(false);
      setSelectedOffer(null);
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to revise renewal offer'),
  });

  // Action handlers
  const handleOpenSingleModal = (row: any) => {
    setSelectedRow(row);
    const agreement = row.current_agreement || {};
    setSingleRent(String(agreement.contract?.rent ?? agreement.contract_rent ?? ''));
    setSingleDeposit(String(agreement.contract?.security_deposit ?? agreement.contract_security_deposit ?? ''));
    setSingleDuration(String(agreement.contract?.agreement_duration_months ?? agreement.contract_duration_months ?? '11'));
    setSingleNotes('');
    
    // Set selected room ID to tenant's current room ID
    const roomVal = row.tenant?.room?.id || row.tenant?.room_id || '';
    setSelectedRoomId(roomVal);
    
    setShowSingleModal(true);
  };

  const handleOpenReviseModal = (offer: any) => {
    setSelectedOffer(offer);
    setSingleRent(String(offer.proposed_rent || ''));
    setSingleDeposit(String(offer.proposed_security_deposit || ''));
    setSingleDuration(String(offer.proposed_duration_months || '11'));
    setSingleNotes(offer.owner_notes || '');
    setShowReviseModal(true);
  };

  const handleOpenBulkModal = () => {
    setBulkRent('');
    setBulkDeposit('');
    setBulkPercent('5');
    setBulkDuration('11');
    setBulkTitle(`Renewal Campaign - ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`);
    
    // Initialize category rents mapping
    const catMapping: Record<string, string> = {};
    uniqueCategories.forEach(cat => {
      catMapping[cat] = '';
    });
    setBulkCategoryRents(catMapping);
    
    setShowBulkModal(true);
  };

  const submitSingleOffer = async () => {
    if (!selectedRow) return;
    if (!singleRent || !singleDeposit || !singleDuration) {
      hmsToast.warning('Validation Error', 'Please fill in all required fields');
      return;
    }
    const currentRoomId = selectedRow.tenant?.room?.id || selectedRow.tenant?.room_id;
    const agreementId = selectedRow.current_agreement?.id;

    if (!agreementId) {
      hmsToast.error('No active agreement found');
      return;
    }

    try {
      setIsShifting(true);
      if (selectedRoomId && selectedRoomId !== currentRoomId) {
        // Shift room first
        const shiftRes = await allocationService.shift(hostelId, {
          tenant_id: selectedRow.tenant?.id,
          new_room_id: selectedRoomId,
          shift_date: new Date().toISOString().split('T')[0],
        });
        if (shiftRes?.error || (shiftRes?.success === false)) {
          throw new Error(shiftRes?.message || 'Failed to shift room');
        }
        hmsToast.success('Room shifted successfully');
      }

      generateSingleMutation.mutate({
        agreementId,
        data: {
          proposed_rent: Number(singleRent),
          proposed_security_deposit: Number(singleDeposit),
          proposed_duration_months: Number(singleDuration),
          owner_notes: singleNotes || undefined,
        }
      });
    } catch (err: any) {
      hmsToast.error(err?.message || 'Failed to shift room prior to generating offer');
    } finally {
      setIsShifting(false);
    }
  };

  const submitReviseOffer = () => {
    if (!selectedOffer) return;
    if (!singleRent || !singleDeposit || !singleDuration) {
      hmsToast.warning('Validation Error', 'Please fill in all required fields');
      return;
    }
    reviseOfferMutation.mutate({
      offerId: selectedOffer.id,
      data: {
        proposed_rent: Number(singleRent),
        proposed_security_deposit: Number(singleDeposit),
        proposed_duration_months: Number(singleDuration),
        owner_notes: singleNotes || undefined,
      }
    });
  };

  const submitBulkOffers = () => {
    if (!hostelId) return;
    if (!bulkDuration) {
      hmsToast.warning('Validation Error', 'Please specify the proposed agreement duration');
      return;
    }

    const payload: any = {
      hostelId,
      renewal_strategy: bulkStrategy,
      proposed_duration_months: Number(bulkDuration),
      title: bulkTitle,
    };

    if (bulkStrategy === 'FLAT') {
      if (!bulkRent) {
        hmsToast.warning('Validation Error', 'Please specify proposed rent for FLAT strategy');
        return;
      }
      payload.proposed_rent = Number(bulkRent);
      if (bulkDeposit) payload.proposed_deposit = Number(bulkDeposit);
    } else if (bulkStrategy === 'PERCENTAGE') {
      if (!bulkPercent) {
        hmsToast.warning('Validation Error', 'Please specify increase percentage');
        return;
      }
      payload.rent_increase_percent = Number(bulkPercent);
    } else if (bulkStrategy === 'ROOM_CATEGORY') {
      const parsedCats: Record<string, number> = {};
      let missingVal = false;
      Object.entries(bulkCategoryRents).forEach(([cat, val]) => {
        if (!val) {
          missingVal = true;
          return;
        }
        parsedCats[cat] = Number(val);
      });

      if (missingVal || Object.keys(parsedCats).length === 0) {
        hmsToast.warning('Validation Error', 'Please fill in rents for all room categories');
        return;
      }
      payload.category_rents = parsedCats;
    }

    generateBulkMutation.mutate(payload);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stay Renewals & Negotiations</p>
          <h1 className="text-2xl font-bold text-foreground">Renewal Pipeline</h1>
          <p className="text-sm text-muted-foreground font-medium">Generate custom stay proposals, manage renewal offers, and automate batch pricing strategies.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={hostelId}
            onChange={(event) => setSelectedHostelId(event.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {hostels.map((hostel) => (
              <option key={String(hostel.id)} value={String(hostel.id)}>{String(hostel.name || 'Hostel')}</option>
            ))}
          </select>
          {activeTab === 'expiring' && (
            <button
              onClick={handleOpenBulkModal}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              Renewal Campaigns Wizard
            </button>
          )}
        </div>
      </header>

      {/* Stay Renewal Pipeline Tracker */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Stage 1: Expiring (Needs Offer) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('expiring');
            setFilter('all');
          }}
          className={`text-left transition-all rounded-xl border p-4 shadow-sm focus:outline-none ${
            activeTab === 'expiring'
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">1. Expiring (Needs Offer)</span>
            <CalendarDays className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{Number(queueCounts.total || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Stays needing attention</p>
        </button>

        {/* Stage 2: Renewal Draft */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('offers');
            setOffersFilter('SENT');
          }}
          className={`text-left transition-all rounded-xl border p-4 shadow-sm focus:outline-none ${
            activeTab === 'offers' && offersFilter === 'SENT'
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">2. Renewal Draft</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{Number((pipelineCounts.DRAFT || 0) + (pipelineCounts.SENT || 0))}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Offers created & sent</p>
        </button>

        {/* Stage 3: Under Negotiation */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('offers');
            setOffersFilter('NEGOTIATING');
          }}
          className={`text-left transition-all rounded-xl border p-4 shadow-sm focus:outline-none ${
            activeTab === 'offers' && offersFilter === 'NEGOTIATING'
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">3. Under Negotiation</span>
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{Number(pipelineCounts.NEGOTIATING || 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Active discussions</p>
        </button>

        {/* Stage 4: Renewed */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('offers');
            setOffersFilter('ACCEPTED');
          }}
          className={`text-left transition-all rounded-xl border p-4 shadow-sm focus:outline-none ${
            activeTab === 'offers' && ['ACCEPTED', 'AWAITING_PAYMENT', 'READY_FOR_SIGNATURE'].includes(offersFilter)
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">4. Renewed (Active/Pending)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {Number((pipelineCounts.ACCEPTED || 0) + (pipelineCounts.READY_FOR_SIGNATURE || 0) + (pipelineCounts.AWAITING_PAYMENT || 0))}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Ready or finalized stays</p>
        </button>
      </section>

      {/* Main Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('expiring')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'expiring'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Expiring Stays (Needs Offer)
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'offers'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Renewal Offers Pipeline
        </button>
      </div>

      {/* Tab Content: Expiring Stays (Queue) */}
      {activeTab === 'expiring' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                  filter === id 
                    ? 'border-accent bg-accent text-accent-foreground' 
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            {isQueueLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Loading renewal queue stays...
              </div>
            ) : isQueueError ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-foreground">Could not load renewals</p>
                <button type="button" onClick={() => refetchQueue()} className="mt-2 text-xs font-bold text-accent">Retry</button>
              </div>
            ) : queueRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-foreground">No stays require renewal offers</p>
                <p className="mt-1 text-xs text-muted-foreground">All contracts are active or have pending offers.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {queueRows.map((row: any) => {
                  const agreement = row.current_agreement || {};
                  const tenant = row.tenant || {};
                  const critical = ['EXPIRED_AND_RENT_OVERDUE', 'RENEWAL_OVERDUE_CRITICAL'].includes(row.decision_state);
                  return (
                    <article key={agreement.id} className="p-5 hover:bg-muted/30 transition-all">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-foreground text-base">{tenant.name || 'Tenant'}</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${critical ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                              {stateLabel(row.decision_state)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-semibold">
                            Room {tenant.room?.room_no || 'N/A'} ({tenant.room?.room_type || 'N/A'}) · Agreement v{agreement.agreement_version || 1} · Ends {fmtDate(agreement.agreement_end_date)}
                          </p>
                          <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                            <span>Current Rent: <strong className="text-foreground">₹{Number(agreement.contract?.rent ?? agreement.contract_rent ?? 0).toLocaleString('en-IN')}</strong></span>
                            <span>Current Deposit: <strong className="text-foreground">₹{Number(agreement.contract?.security_deposit ?? agreement.contract_security_deposit ?? 0).toLocaleString('en-IN')}</strong></span>
                          </div>
                          {row.overdue_rent?.count > 0 && (
                            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Rent overdue: ₹{Number(row.overdue_rent.amount || 0).toLocaleString('en-IN')} ({row.overdue_rent.count} month{row.overdue_rent.count > 1 ? 's' : ''})
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenSingleModal(row)}
                            className="rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground transition-all hover:bg-accent/90 flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Create Offer
                          </button>
                          <Link
                            to={`/hostels/${agreement.hostel_id}/tenants/${tenant.id}`}
                            className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab Content: Renewal Offers Pipeline */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ['ALL', `All (${offerRows.length})`],
              ['DRAFT', `Drafts (${pipelineCounts.DRAFT ?? 0})`],
              ['SENT', `Sent (${pipelineCounts.SENT ?? 0})`],
              ['NEGOTIATING', `Negotiating (${pipelineCounts.NEGOTIATING ?? 0})`],
              ['ACCEPTED', `Accepted (${pipelineCounts.ACCEPTED ?? 0})`],
              ['AWAITING_PAYMENT', `Awaiting Payment (${pipelineCounts.AWAITING_PAYMENT ?? 0})`],
              ['READY_FOR_SIGNATURE', `Ready for Sign (${pipelineCounts.READY_FOR_SIGNATURE ?? 0})`],
              ['DECLINED', `Declined (${pipelineCounts.DECLINED ?? 0})`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOffersFilter(id as any)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                  offersFilter === id 
                    ? 'border-accent bg-accent text-accent-foreground' 
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            {isOffersLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Loading renewal offers pipeline...
              </div>
            ) : isOffersError ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-foreground">Could not load active offers</p>
                <button type="button" onClick={() => refetchOffers()} className="mt-2 text-xs font-bold text-accent">Retry</button>
              </div>
            ) : offerRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-foreground">No renewal offers generated yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Generate renewal offers from the 'Expiring Stays' tab.</p>
              </div>
            ) : filteredOfferRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-foreground">No offers matching status filter</p>
                <p className="mt-1 text-xs text-muted-foreground">Try clearing the status filter to see all active offers.</p>
                <button
                  type="button"
                  onClick={() => setOffersFilter('ALL')}
                  className="mt-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
                >
                  Clear Filter
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredOfferRows.map((offer: any) => {
                  const tenant = offer.tenant || {};
                  const isDraft = offer.status === 'DRAFT';
                  const isSent = offer.status === 'SENT';
                  const isDeclined = offer.status === 'DECLINED';
                  
                  return (
                    <article key={offer.id} className="p-5 hover:bg-muted/30 transition-all">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground text-base">{tenant.profiles?.name || 'Tenant'}</h3>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeColor(offer.status)}`}>
                              {offer.status}
                            </span>
                            {offer.is_custom_override && (
                              <span className="rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          
                          {/* Details Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                            <div className="text-muted-foreground font-medium">
                              Rent: <span className="text-foreground font-bold">₹{Number(offer.current_rent).toLocaleString('en-IN')}</span> 
                              <ArrowRight className="inline-block h-3 w-3 mx-1 text-muted-foreground" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{Number(offer.proposed_rent).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-muted-foreground font-medium">
                              Deposit: <span className="text-foreground font-bold">₹{Number(offer.current_security_deposit).toLocaleString('en-IN')}</span>
                              <ArrowRight className="inline-block h-3 w-3 mx-1 text-muted-foreground" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{Number(offer.proposed_security_deposit).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-muted-foreground font-medium col-span-2">
                              Timeline: <span className="text-foreground font-semibold">{fmtDate(offer.proposed_start_date)} - {fmtDate(offer.proposed_end_date)} ({offer.proposed_duration_months}m)</span>
                            </div>
                          </div>
 
                          {/* Delta and explanation */}
                          <div className="flex flex-wrap gap-4 text-xs font-semibold">
                            {Number(offer.additional_deposit_required) > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded">
                                Additional Deposit Top-up Required: ₹{Number(offer.additional_deposit_required).toLocaleString('en-IN')}
                              </span>
                            )}
                            {Number(offer.deposit_refund_eligible) > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Deposit Refund Eligible: ₹{Number(offer.deposit_refund_eligible).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
 
                          {/* Notes / Decline Reason */}
                          {offer.owner_notes && (
                            <p className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border">
                              <span className="font-bold text-foreground">Owner Note:</span> {offer.owner_notes}
                            </p>
                          )}
                          {offer.decline_reason && (
                            <p className="text-xs text-rose-700 bg-rose-500/5 p-2 rounded border border-rose-200">
                              <span className="font-bold">Decline Reason:</span> {offer.decline_reason}
                            </p>
                          )}
                        </div>
 
                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 sm:self-center">
                          {isDraft && (
                            <button
                              onClick={() => sendOfferMutation.mutate(offer.id)}
                              disabled={sendOfferMutation.isPending}
                              className="rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground transition-all hover:bg-accent/90 flex items-center gap-1 shadow-sm"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Send Offer
                            </button>
                          )}
                          {(isDraft || isSent || isDeclined) && (
                            <button
                              onClick={() => handleOpenReviseModal(offer)}
                              className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted flex items-center gap-1"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Revise Terms
                            </button>
                          )}
                          <Link
                            to={`/hostels/${offer.hostel_id}/tenants/${offer.tenant_id}`}
                            className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
                          >
                            Profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL 1: Bulk Renewal Offers Strategy Wizard */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xl font-extrabold text-foreground">Renewal Campaigns Wizard</h2>
              <button onClick={() => setShowBulkModal(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Batch title */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Campaign Name / Title</label>
                <input
                  type="text"
                  value={bulkTitle}
                  onChange={(e) => setBulkTitle(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Strategy selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Select Renewal Strategy</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setBulkStrategy('FLAT')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all ${
                      bulkStrategy === 'FLAT' 
                        ? 'border-accent bg-accent/5 text-foreground font-bold' 
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Coins className="h-5 w-5 mb-1 text-accent" />
                    <span className="text-sm">FLAT</span>
                    <span className="text-[10px] text-muted-foreground font-normal mt-0.5">Fixed Rent/Deposit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkStrategy('PERCENTAGE')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all ${
                      bulkStrategy === 'PERCENTAGE' 
                        ? 'border-accent bg-accent/5 text-foreground font-bold' 
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <RefreshCw className="h-5 w-5 mb-1 text-accent" />
                    <span className="text-sm">PERCENT</span>
                    <span className="text-[10px] text-muted-foreground font-normal mt-0.5">Rent % Increase</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkStrategy('ROOM_CATEGORY')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all ${
                      bulkStrategy === 'ROOM_CATEGORY' 
                        ? 'border-accent bg-accent/5 text-foreground font-bold' 
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="h-5 w-5 mb-1 text-accent" />
                    <span className="text-sm">CATEGORY</span>
                    <span className="text-[10px] text-muted-foreground font-normal mt-0.5">Price by Room Type</span>
                  </button>
                </div>
              </div>

              {/* Dynamic strategy configuration parameters */}
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-4">
                {bulkStrategy === 'FLAT' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-foreground">Proposed Monthly Rent (₹) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 8500"
                        value={bulkRent}
                        onChange={(e) => setBulkRent(e.target.value)}
                        className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-foreground">Proposed Security Deposit (₹)</label>
                      <input
                        type="number"
                        placeholder="Leave blank to match current"
                        value={bulkDeposit}
                        onChange={(e) => setBulkDeposit(e.target.value)}
                        className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                )}

                {bulkStrategy === 'PERCENTAGE' && (
                  <div>
                    <label className="text-xs font-bold text-foreground">Proposed Rent Increase Percentage (%) *</label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={bulkPercent}
                        onChange={(e) => setBulkPercent(e.target.value)}
                        className="w-24 h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <span className="text-sm text-muted-foreground font-semibold">Rent will be increased by {bulkPercent}% for all matching expiring agreements.</span>
                    </div>
                  </div>
                )}

                {bulkStrategy === 'ROOM_CATEGORY' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground block mb-1">Set Rents for Room Categories *</h4>
                    {uniqueCategories.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No room categories found in the queue. Type categories and rents manually:</p>
                    ) : null}
                    
                    <div className="space-y-2">
                      {uniqueCategories.map(cat => (
                        <div key={cat} className="flex items-center justify-between gap-4">
                          <span className="text-sm font-bold text-foreground">{cat} Category:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">₹</span>
                            <input
                              type="number"
                              placeholder="e.g. 9500"
                              value={bulkCategoryRents[cat] || ''}
                              onChange={(e) => setBulkCategoryRents({
                                ...bulkCategoryRents,
                                [cat]: e.target.value
                              })}
                              className="w-32 h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                        </div>
                      ))}
                      
                      {/* Allow adding custom categories manually */}
                      <button
                        type="button"
                        onClick={() => {
                          const catName = prompt('Enter room category name (e.g. AC, Non-AC):');
                          if (catName && catName.trim()) {
                            setBulkCategoryRents({
                              ...bulkCategoryRents,
                              [catName.trim().toUpperCase()]: ''
                            });
                          }
                        }}
                        className="text-xs font-bold text-accent hover:underline flex items-center gap-1 mt-2"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Custom Category Mapping
                      </button>
                    </div>
                  </div>
                )}

                {/* Duration */}
                <div>
                  <label className="text-xs font-bold text-foreground">Proposed Agreement Duration (Months) *</label>
                  <input
                    type="number"
                    value={bulkDuration}
                    onChange={(e) => setBulkDuration(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulkOffers}
                disabled={generateBulkMutation.isPending}
                className="rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-accent-foreground transition-all hover:bg-accent/90 flex items-center gap-1 shadow-sm"
              >
                {generateBulkMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Launch Renewal Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Custom Single Offer */}
      {showSingleModal && selectedRow && (() => {
        const agreement = selectedRow.current_agreement;
        if (!agreement) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-xl font-extrabold text-foreground">Create Custom Stay Offer</h2>
                  <button onClick={() => setShowSingleModal(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/20 text-center space-y-3">
                  <AlertTriangle className="h-10 w-10 text-destructive mx-auto animate-bounce" />
                  <div>
                    <h3 className="text-sm font-bold text-destructive">No Active Agreement</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      This tenant does not have an active signed stay agreement. A renewal offer cannot be created without an active baseline.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowSingleModal(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const currentRentVal = Number(agreement.contract?.rent ?? agreement.contract_rent ?? 0);
        const currentDepositVal = Number(agreement.contract?.security_deposit ?? agreement.contract_security_deposit ?? 0);
        const currentDurationVal = Number(agreement.contract?.agreement_duration_months ?? agreement.contract_duration_months ?? 11);

        const proposedRentVal = Number(singleRent || 0);
        const proposedDepositVal = Number(singleDeposit || 0);
        const proposedDurationVal = Number(singleDuration || 0);

        const rentDiff = proposedRentVal - currentRentVal;
        const depositDiff = proposedDepositVal - currentDepositVal;
        const durationDiff = proposedDurationVal - currentDurationVal;

        const handleResetToCurrent = () => {
          setSingleRent(String(currentRentVal));
          setSingleDeposit(String(currentDepositVal));
          setSingleDuration(String(currentDurationVal));
        };

        const currentRoomId = selectedRow.tenant?.room?.id || selectedRow.tenant?.room_id;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-xl font-extrabold text-foreground">Create Custom Stay Offer</h2>
                <button onClick={() => setShowSingleModal(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Tenant Context Summary */}
                <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Tenant</p>
                      <h4 className="text-sm font-bold text-foreground">{selectedRow.tenant?.name || 'Tenant'}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Current Room</p>
                      <h4 className="text-sm font-bold text-foreground">Room {selectedRow.tenant?.room?.room_no || 'N/A'}</h4>
                    </div>
                  </div>
                </div>

                {/* Current Agreement Terms Snapshot */}
                <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Agreement Summary</h3>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Monthly Rent</span>
                      <strong className="text-foreground text-sm">₹{currentRentVal.toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Deposit Held</span>
                      <strong className="text-foreground text-sm">₹{currentDepositVal.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Maintenance Charge</span>
                      <strong className="text-foreground">
                        ₹{Number(agreement.contract?.maintenance_charge ?? agreement.maintenance_charge ?? 0).toLocaleString('en-IN')}
                        {agreement.contract?.maintenance_type === 'MONTHLY' ? '/mo' : ''}
                      </strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Duration</span>
                      <strong className="text-foreground">{currentDurationVal} months</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Agreement Start</span>
                      <strong className="text-foreground">{fmtDate(agreement.agreement_start_date)}</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wide">Agreement End</span>
                      <strong className="text-foreground">{fmtDate(agreement.agreement_end_date)}</strong>
                    </div>
                  </div>
                </div>

                {/* Room Selector */}
                <div>
                  <label className="text-xs font-bold text-foreground">Room Assignment (Stay Location) *</label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                  >
                    {availableRooms.map((r: any) => {
                      const occ = Number(r.occupied_count ?? 0);
                      const cap = Number(r.capacity ?? 1);
                      const floor = r.floor_name ? ` · ${r.floor_name}` : '';
                      const isCurrent = r.id === currentRoomId;
                      return (
                        <option key={r.id} value={r.id}>
                          {r.room_no}{floor} ({r.room_type || 'N/A'}) · {occ}/{cap} beds occupied {isCurrent ? '(Current Room)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Proposed stay offer terms */}
                <div className="space-y-3.5 border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proposed Renewal Offer Terms</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-foreground">Proposed Monthly Rent (₹) *</label>
                      <input
                        type="number"
                        value={singleRent}
                        onChange={(e) => setSingleRent(e.target.value)}
                        className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-foreground">Proposed Security Deposit (₹) *</label>
                      <input
                        type="number"
                        value={singleDeposit}
                        onChange={(e) => setSingleDeposit(e.target.value)}
                        className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground">Proposed Duration (Months) *</label>
                    <input
                      type="number"
                      value={singleDuration}
                      onChange={(e) => setSingleDuration(e.target.value)}
                      className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground">Owner Notes / Custom Terms</label>
                    <textarea
                      value={singleNotes}
                      onChange={(e) => setSingleNotes(e.target.value)}
                      placeholder="e.g. Discussed rent raise on call, agreed to premium room top-up."
                      className="mt-1 w-full h-20 rounded-lg border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    />
                  </div>
                </div>

                {/* Comparison & Breakdown Panel */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer Comparison Summary</h3>
                    <button
                      type="button"
                      onClick={handleResetToCurrent}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset to Current
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Rent Comparison Card */}
                    <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Rent Change</span>
                      <div className="text-xs text-muted-foreground">
                        ₹{currentRentVal.toLocaleString('en-IN')} ➜ <strong className="text-foreground">₹{proposedRentVal.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className={`text-[10px] font-bold ${rentDiff > 0 ? 'text-amber-600 dark:text-amber-400' : rentDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {rentDiff > 0 ? `+₹${rentDiff.toLocaleString('en-IN')} (+${currentRentVal > 0 ? ((rentDiff/currentRentVal)*100).toFixed(1) : 0}%)` : rentDiff < 0 ? `-₹${Math.abs(rentDiff).toLocaleString('en-IN')}` : 'No Change'}
                      </div>
                    </div>

                    {/* Deposit Comparison Card */}
                    <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Deposit Change</span>
                      <div className="text-xs text-muted-foreground">
                        ₹{currentDepositVal.toLocaleString('en-IN')} ➜ <strong className="text-foreground">₹{proposedDepositVal.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className={`text-[10px] font-bold ${depositDiff > 0 ? 'text-amber-600 dark:text-amber-400' : depositDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {depositDiff > 0 ? `+₹${depositDiff.toLocaleString('en-IN')}` : depositDiff < 0 ? `-₹${Math.abs(depositDiff).toLocaleString('en-IN')}` : 'No Change'}
                      </div>
                    </div>

                    {/* Duration Comparison Card */}
                    <div className="bg-card border border-border rounded-xl p-3 text-center space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Duration</span>
                      <div className="text-xs text-muted-foreground">
                        {currentDurationVal}m ➜ <strong className="text-foreground">{proposedDurationVal}m</strong>
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground">
                        {durationDiff > 0 ? `+${durationDiff} months` : durationDiff < 0 ? `${durationDiff} months` : 'No Change'}
                      </div>
                    </div>
                  </div>

                  {/* Visual Breakdown Card */}
                  <div className={`p-4 rounded-xl border text-xs font-semibold ${
                    depositDiff > 0 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300' 
                      : depositDiff < 0 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-muted/40 border-border text-muted-foreground'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5 font-bold text-foreground">
                      <span>Deposit Financial Action</span>
                      <span className="uppercase tracking-wide text-[9px] px-2 py-0.5 rounded-full bg-background border border-border font-bold">
                        {depositDiff > 0 ? 'Payment Action' : depositDiff < 0 ? 'Credit/Refund Action' : 'No Action'}
                      </span>
                    </div>
                    <div className="space-y-1 font-medium text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Current Deposit Held:</span>
                        <span className="text-foreground font-bold">₹{currentDepositVal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Proposed Deposit:</span>
                        <span className="text-foreground font-bold">₹{proposedDepositVal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="border-t border-dashed border-border my-1.5"></div>
                      <div className="flex justify-between font-bold text-foreground">
                        {depositDiff > 0 ? (
                          <>
                            <span className="text-amber-700 dark:text-amber-400">Tenant Top-up Required:</span>
                            <span className="text-amber-700 dark:text-amber-400 font-extrabold text-sm">₹{depositDiff.toLocaleString('en-IN')}</span>
                          </>
                        ) : depositDiff < 0 ? (
                          <>
                            <span className="text-emerald-700 dark:text-emerald-400">Excess Refund / Credit to Account:</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">₹{Math.abs(depositDiff).toLocaleString('en-IN')}</span>
                          </>
                        ) : (
                          <>
                            <span>No Change in Deposit:</span>
                            <span>₹0</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitSingleOffer}
                  disabled={generateSingleMutation.isPending || isShifting}
                  className="rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-accent-foreground transition-all hover:bg-accent/90 flex items-center gap-1 shadow-sm"
                >
                  {generateSingleMutation.isPending || isShifting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isShifting ? 'Shifting Room...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Generate Offer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: Revise Renewal Offer */}
      {showReviseModal && selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xl font-extrabold text-foreground">Revise Renewal Offer</h2>
              <button onClick={() => setShowReviseModal(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-foreground">Tenant: {selectedOffer.tenant?.profiles?.name || 'Tenant'}</p>
                <p className="text-muted-foreground font-semibold font-mono">Current Status: {selectedOffer.status}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground">Revised Rent (₹) *</label>
                  <input
                    type="number"
                    value={singleRent}
                    onChange={(e) => setSingleRent(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground">Revised Security Deposit (₹) *</label>
                  <input
                    type="number"
                    value={singleDeposit}
                    onChange={(e) => setSingleDeposit(e.target.value)}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">Revised Duration (Months) *</label>
                <input
                  type="number"
                  value={singleDuration}
                  onChange={(e) => setSingleDuration(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">Revised Offer Notes</label>
                <textarea
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
                  placeholder="e.g. Tenant requested custom discount, agreed to ₹8,200 rent."
                  className="mt-1 w-full h-20 rounded-lg border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReviseOffer}
                disabled={reviseOfferMutation.isPending}
                className="rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-accent-foreground transition-all hover:bg-accent/90 flex items-center gap-1 shadow-sm"
              >
                {reviseOfferMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Revising...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Submit Revision
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="text-xs font-extrabold uppercase tracking-widest">{label}</p>
        {icon}
      </div>
      <p className="mt-2.5 text-3xl font-black text-foreground font-mono">{value}</p>
    </div>
  );
}
