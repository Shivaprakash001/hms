import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { agreementService } from '@features/agreements/api';
import { roomService, allocationService } from '@features/rooms/api';
import { hmsToast } from '@lib/toast';
import { RenewalPipelineTracker, pipelineIcons } from './renewal/RenewalPipelineTracker';
import { RenewalQueueList } from './renewal/RenewalQueueList';
import { RenewalOffersList } from './renewal/RenewalOffersList';
import { BulkCampaignSheet } from './renewal/BulkCampaignSheet';
import { SingleOfferSheet } from './renewal/SingleOfferSheet';
import { ReviseOfferSheet } from './renewal/ReviseOfferSheet';
import { deriveRoomGroupings, readHostels } from './renewal/utils';

type QueueFilter = 'all' | 'expiring' | 'expired' | 'overdue' | 'move_out';
type TabType = 'expiring' | 'offers';

export function RenewalQueueView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('expiring');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [selectedHostelId, setSelectedHostelId] = useState('');

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [offersFilter, setOffersFilter] = useState<string>('ALL');
  const [isShifting, setIsShifting] = useState(false);
  const [roomNoFilter, setRoomNoFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Fetch all rooms in the hostel (for the single-offer room shift selector)
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

  const roomGroupings = useMemo(() => deriveRoomGroupings(queueRows), [queueRows]);
  const visibleQueueRows = useMemo(
    () =>
      queueRows.filter((row: any) => {
        if (roomNoFilter !== 'all' && row.tenant?.room?.room_no !== roomNoFilter) return false;
        if (roomTypeFilter !== 'all' && row.tenant?.room?.room_type !== roomTypeFilter) return false;
        if (floorFilter !== 'all' && row.tenant?.room?.floor_name !== floorFilter) return false;
        return true;
      }),
    [queueRows, roomNoFilter, roomTypeFilter, floorFilter],
  );
  const scopedQueueRows = useMemo(
    () => (selectedIds.size > 0 ? queueRows.filter((row: any) => selectedIds.has(row.current_agreement?.id)) : queueRows),
    [queueRows, selectedIds],
  );

  const offerRows = Array.isArray(offersData?.offers) ? offersData.offers : [];
  const pipelineCounts = offersData?.pipeline || {};

  const filteredOfferRows = useMemo(() => {
    if (offersFilter === 'ALL') return offerRows;
    return offerRows.filter((offer: any) => offer.pipeline_status === offersFilter);
  }, [offerRows, offersFilter]);

  const queueFilters = useMemo(
    () =>
      [
        ['all', `All ${queueCounts.total ?? 0}`],
        ['expiring', `Expiring ${queueCounts.expiring ?? 0}`],
        ['expired', `Expired ${queueCounts.expired ?? 0}`],
        ['overdue', `Overdue ${queueCounts.overdue ?? 0}`],
        ['move_out', `Move-out ${queueCounts.move_out ?? 0}`],
      ] as [QueueFilter, string][],
    [queueCounts],
  );

  const offerFilterOptions = useMemo(
    () =>
      [
        ['ALL', `All (${offerRows.length})`],
        ['DRAFT', `Drafts (${pipelineCounts.DRAFT ?? 0})`],
        ['SENT', `Sent (${pipelineCounts.SENT ?? 0})`],
        ['NEGOTIATING', `Negotiating (${pipelineCounts.NEGOTIATING ?? 0})`],
        ['ACCEPTED', `Accepted (${pipelineCounts.ACCEPTED ?? 0})`],
        ['AWAITING_PAYMENT', `Awaiting Payment (${pipelineCounts.AWAITING_PAYMENT ?? 0})`],
        ['READY_FOR_SIGNATURE', `Ready for Sign (${pipelineCounts.READY_FOR_SIGNATURE ?? 0})`],
        ['DECLINED', `Declined (${pipelineCounts.DECLINED ?? 0})`],
        ['EXPIRED', `Expired (${pipelineCounts.EXPIRED ?? 0})`],
      ] as [string, string][],
    [offerRows.length, pipelineCounts],
  );

  // Mutations
  const generateSingleMutation = useMutation({
    mutationFn: ({ agreementId, data }: { agreementId: string; data: any }) =>
      agreementService.generateRenewalOffer(agreementId, data),
    onSuccess: () => {
      hmsToast.success('Renewal offer created successfully');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
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
      setSelectedIds(new Set());
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to launch renewal campaign'),
  });

  const toggleSelect = (id: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const sendOfferMutation = useMutation({
    mutationFn: (offerId: string) => agreementService.sendRenewalOffer(offerId),
    onSuccess: () => {
      hmsToast.success('Renewal offer sent to tenant');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to send renewal offer'),
  });

  const resendOfferMutation = useMutation({
    mutationFn: (offerId: string) => agreementService.resendRenewalOffer(offerId),
    onSuccess: () => {
      hmsToast.success('Renewal offer resent to tenant');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-workspace'] });
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to resend renewal offer'),
  });

  const reviseOfferMutation = useMutation({
    mutationFn: ({ offerId, data }: { offerId: string; data: any }) =>
      agreementService.reviseRenewalOffer(offerId, data),
    onSuccess: () => {
      hmsToast.success('Renewal offer revised successfully');
      queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
      setSelectedOffer(null);
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to revise renewal offer'),
  });

  const submitSingleOffer = async (data: { selectedRoomId: string; rent: string; deposit: string; duration: string; notes: string }) => {
    if (!selectedRow) return;
    const agreementId = selectedRow.current_agreement?.id;
    if (!agreementId) {
      hmsToast.error('No active agreement found');
      return;
    }

    try {
      setIsShifting(true);
      if (data.selectedRoomId && data.selectedRoomId !== currentRoomId) {
        const shiftRes = await allocationService.shift(hostelId, {
          tenant_id: selectedRow.tenant?.id,
          new_room_id: data.selectedRoomId,
          shift_date: new Date().toISOString().split('T')[0],
        });
        if (shiftRes?.error || shiftRes?.success === false) {
          throw new Error(shiftRes?.message || 'Failed to shift room');
        }
        hmsToast.success('Room shifted successfully');
      }

      generateSingleMutation.mutate({
        agreementId,
        data: {
          proposed_rent: Number(data.rent),
          proposed_security_deposit: Number(data.deposit),
          proposed_duration_months: Number(data.duration),
          owner_notes: data.notes || undefined,
        },
      });
    } catch (err: any) {
      hmsToast.error(err?.message || 'Failed to shift room prior to generating offer');
    } finally {
      setIsShifting(false);
    }
  };

  const submitReviseOffer = (data: { rent: string; deposit: string; duration: string; notes: string }) => {
    if (!selectedOffer) return;
    reviseOfferMutation.mutate({
      offerId: selectedOffer.id,
      data: {
        proposed_rent: Number(data.rent),
        proposed_security_deposit: Number(data.deposit),
        proposed_duration_months: Number(data.duration),
        owner_notes: data.notes || undefined,
      },
    });
  };

  return (
    <div className="space-y-5 px-4 py-4 sm:px-0 sm:py-0">
      {/* Top Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stay Renewals & Negotiations</p>
          <h1 className="text-2xl font-bold text-foreground">Renewal Pipeline</h1>
          <p className="text-sm font-medium text-muted-foreground">Generate custom stay proposals, manage renewal offers, and automate batch pricing strategies.</p>
          <Link to="/agreements/lifecycle-recovery" className="mt-1 inline-block text-xs font-bold text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
            Legacy agreement data recovery →
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={hostelId}
            onChange={(event) => setSelectedHostelId(event.target.value)}
            className="h-11 flex-1 cursor-pointer rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent sm:h-10 sm:flex-none"
          >
            {hostels.map((hostel) => (
              <option key={String(hostel.id)} value={String(hostel.id)}>{String(hostel.name || 'Hostel')}</option>
            ))}
          </select>
          {activeTab === 'expiring' && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 sm:h-10"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Renewal Campaigns Wizard</span>
              <span className="sm:hidden">Campaign</span>
            </button>
          )}
        </div>
      </header>

      {/* Stay Renewal Pipeline Tracker */}
      <RenewalPipelineTracker
        stages={[
          {
            key: 'expiring',
            label: '1. Expiring (Needs Offer)',
            shortLabel: 'Expiring',
            sub: 'Stays needing attention',
            value: Number(queueCounts.total || 0),
            icon: pipelineIcons.expiring,
            active: activeTab === 'expiring',
            onClick: () => {
              setActiveTab('expiring');
              setFilter('all');
            },
          },
          {
            key: 'draft',
            label: '2. Renewal Draft',
            shortLabel: 'Draft',
            sub: 'Offers created & sent',
            value: Number((pipelineCounts.DRAFT || 0) + (pipelineCounts.SENT || 0)),
            icon: pipelineIcons.draft,
            active: activeTab === 'offers' && offersFilter === 'SENT',
            onClick: () => {
              setActiveTab('offers');
              setOffersFilter('SENT');
            },
          },
          {
            key: 'negotiating',
            label: '3. Under Negotiation',
            shortLabel: 'Negotiating',
            sub: 'Active discussions',
            value: Number(pipelineCounts.NEGOTIATING || 0),
            icon: pipelineIcons.negotiating,
            active: activeTab === 'offers' && offersFilter === 'NEGOTIATING',
            onClick: () => {
              setActiveTab('offers');
              setOffersFilter('NEGOTIATING');
            },
          },
          {
            key: 'renewed',
            label: '4. Renewed (Active/Pending)',
            shortLabel: 'Renewed',
            sub: 'Ready or finalized stays',
            value: Number((pipelineCounts.ACCEPTED || 0) + (pipelineCounts.READY_FOR_SIGNATURE || 0) + (pipelineCounts.AWAITING_PAYMENT || 0)),
            icon: pipelineIcons.renewed,
            active: activeTab === 'offers' && ['ACCEPTED', 'AWAITING_PAYMENT', 'READY_FOR_SIGNATURE'].includes(offersFilter),
            onClick: () => {
              setActiveTab('offers');
              setOffersFilter('ACCEPTED');
            },
          },
        ]}
      />

      {/* Main Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('expiring')}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-all ${
            activeTab === 'expiring' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Expiring Stays
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-all ${
            activeTab === 'offers' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Offers Pipeline
        </button>
      </div>

      {activeTab === 'expiring' && (
        <RenewalQueueList
          isLoading={isQueueLoading}
          isError={isQueueError}
          onRetry={() => refetchQueue()}
          rows={visibleQueueRows}
          filter={filter}
          filters={queueFilters}
          onFilterChange={setFilter}
          roomNoFilter={roomNoFilter}
          roomNoOptions={roomGroupings.rooms}
          onRoomNoFilterChange={setRoomNoFilter}
          roomTypeFilter={roomTypeFilter}
          roomTypeOptions={roomGroupings.categories}
          onRoomTypeFilterChange={setRoomTypeFilter}
          floorFilter={floorFilter}
          floorOptions={roomGroupings.floors}
          onFloorFilterChange={setFloorFilter}
          onCreateOffer={(row) => setSelectedRow(row)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectGroup={selectGroup}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkGenerate={() => setShowBulkModal(true)}
        />
      )}

      {activeTab === 'offers' && (
        <RenewalOffersList
          isLoading={isOffersLoading}
          isError={isOffersError}
          onRetry={() => refetchOffers()}
          offerRows={offerRows}
          filteredOfferRows={filteredOfferRows}
          offersFilter={offersFilter}
          filterOptions={offerFilterOptions}
          onFilterChange={setOffersFilter}
          onSend={(offerId) => sendOfferMutation.mutate(offerId)}
          isSending={sendOfferMutation.isPending}
          onResend={(offerId) => resendOfferMutation.mutate(offerId)}
          isResending={resendOfferMutation.isPending}
          onRevise={(offer) => setSelectedOffer(offer)}
        />
      )}

      <BulkCampaignSheet
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        hostelId={hostelId}
        queueRows={scopedQueueRows}
        scopedAgreementIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
        onSubmit={(payload) => generateBulkMutation.mutate(payload)}
        isSubmitting={generateBulkMutation.isPending}
      />

      {selectedRow && (
        <SingleOfferSheet
          key={selectedRow.current_agreement?.id || selectedRow.tenant?.id}
          open={Boolean(selectedRow)}
          onOpenChange={(open) => !open && setSelectedRow(null)}
          row={selectedRow}
          availableRooms={availableRooms}
          onSubmit={submitSingleOffer}
          isSubmitting={generateSingleMutation.isPending || isShifting}
          submittingLabel={isShifting ? 'Shifting Room...' : 'Generating...'}
        />
      )}

      {selectedOffer && (
        <ReviseOfferSheet
          key={selectedOffer.id}
          open={Boolean(selectedOffer)}
          onOpenChange={(open) => !open && setSelectedOffer(null)}
          offer={selectedOffer}
          onSubmit={submitReviseOffer}
          isSubmitting={reviseOfferMutation.isPending}
        />
      )}
    </div>
  );
}
