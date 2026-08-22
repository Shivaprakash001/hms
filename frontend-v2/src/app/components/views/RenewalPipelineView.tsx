import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { agreementService } from '@features/agreements/api';
import { roomService, allocationService } from '@features/rooms/api';
import { hmsToast } from '@lib/toast';
import { RenewalPipelineTracker, pipelineIcons } from './renewal/RenewalPipelineTracker';
import { RenewalPipelineList } from './renewal/RenewalPipelineList';
import { RenewalDetailSheet } from './renewal/RenewalDetailSheet';
import { BulkCampaignSheet } from './renewal/BulkCampaignSheet';
import { SingleOfferSheet } from './renewal/SingleOfferSheet';
import { ReviseOfferSheet } from './renewal/ReviseOfferSheet';
import { STAGE_ORDER, deriveRoomGroupings, readHostels, stageLabel } from './renewal/utils';

/**
 * The single owner renewal screen. Replaces the former Expiring Stays / Offers
 * Pipeline tab pair plus the standalone /agreements/renewals/:agreementId
 * workspace page — all three showed slices of the same tenant with different
 * status vocabularies, and a tenant who had been sent an offer appeared in both
 * lists under contradictory labels.
 *
 * Rows come from the unified read model (`/agreements/renewal-pipeline`), which
 * resolves one `stage` per agreement. `:agreementId` in the URL opens that row's
 * detail sheet, so old deep links keep working.
 */
export function RenewalPipelineView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { agreementId: routeAgreementId } = useParams<{ agreementId?: string }>();

  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [stage, setStage] = useState<string>('ALL');
  const [roomNoFilter, setRoomNoFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [detailRowId, setDetailRowId] = useState<string | null>(routeAgreementId || null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [offerRow, setOfferRow] = useState<any>(null);
  const [reviseRow, setReviseRow] = useState<any>(null);
  const [isShifting, setIsShifting] = useState(false);

  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });
  const hostels = readHostels(hostelsRaw);
  const hostelId = selectedHostelId || (hostels[0]?.id ? String(hostels[0].id) : '');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agreements', 'renewal-pipeline', hostelId],
    queryFn: () => agreementService.getRenewalPipeline({ hostelId }),
    enabled: Boolean(hostelId),
    staleTime: 30_000,
  });

  const { data: roomsRaw = [] } = useQuery({
    queryKey: ['rooms', 'list', hostelId],
    queryFn: () => roomService.getAll(hostelId),
    enabled: Boolean(hostelId),
    staleTime: 5 * 60_000,
  });
  const rooms = Array.isArray(roomsRaw) ? roomsRaw : [];

  const allRows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
  const counts = data?.counts || {};

  const roomGroupings = useMemo(() => deriveRoomGroupings(allRows), [allRows]);

  const visibleRows = useMemo(
    () =>
      allRows.filter((row: any) => {
        if (stage !== 'ALL' && row.stage !== stage) return false;
        if (roomNoFilter !== 'all' && row.tenant?.room?.room_no !== roomNoFilter) return false;
        if (roomTypeFilter !== 'all' && row.tenant?.room?.room_type !== roomTypeFilter) return false;
        if (floorFilter !== 'all' && row.tenant?.room?.floor_name !== floorFilter) return false;
        return true;
      }),
    [allRows, stage, roomNoFilter, roomTypeFilter, floorFilter],
  );

  // Stage chips are built from whole-pipeline counts so they never collapse to
  // zero when a stage is selected. Empty stages are hidden to keep the strip short.
  const stageChips = useMemo(() => {
    const chips: [string, string][] = [['ALL', `All ${counts.ALL ?? 0}`]];
    STAGE_ORDER.forEach((s) => {
      const n = counts[s] ?? 0;
      if (n > 0 || stage === s) chips.push([s, `${stageLabel(s)} ${n}`]);
    });
    return chips;
  }, [counts, stage]);

  const detailRow = useMemo(
    () => allRows.find((row: any) => row.agreement_id === detailRowId) || null,
    [allRows, detailRowId],
  );

  // A deep link may land before rows load; once they do, adopt the URL's row.
  useEffect(() => {
    if (routeAgreementId) setDetailRowId(routeAgreementId);
  }, [routeAgreementId]);

  const closeDetail = () => {
    setDetailRowId(null);
    if (routeAgreementId) navigate('/agreements/renewals', { replace: true });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-workspace'] });
    queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-offers'] });
    queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
  };

  const [busyAgreementId, setBusyAgreementId] = useState<string | null>(null);

  const sendOfferMutation = useMutation({
    mutationFn: ({ offerId }: { offerId: string; agreementId: string }) => agreementService.sendRenewalOffer(offerId),
    onSuccess: () => { hmsToast.success('Renewal offer sent to tenant'); invalidate(); },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to send renewal offer'),
    onSettled: () => setBusyAgreementId(null),
  });

  const resendOfferMutation = useMutation({
    mutationFn: ({ offerId }: { offerId: string; agreementId: string }) => agreementService.resendRenewalOffer(offerId),
    onSuccess: () => { hmsToast.success('Renewal offer resent to tenant'); invalidate(); },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to resend renewal offer'),
    onSettled: () => setBusyAgreementId(null),
  });

  const generateSingleMutation = useMutation({
    mutationFn: ({ agreementId, data: payload }: { agreementId: string; data: any }) =>
      agreementService.generateRenewalOffer(agreementId, payload),
    onSuccess: () => { hmsToast.success('Renewal offer created'); invalidate(); setOfferRow(null); },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to generate renewal offer'),
  });

  const generateBulkMutation = useMutation({
    mutationFn: (payload: any) => agreementService.generateBulkRenewalOffers(payload),
    onSuccess: (res: any) => {
      hmsToast.success(`Renewal campaign launched! Generated ${res.offersGenerated} offers.`);
      invalidate();
      setShowBulkModal(false);
      setSelectedIds(new Set());
    },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to launch renewal campaign'),
  });

  const reviseOfferMutation = useMutation({
    mutationFn: ({ offerId, data: payload }: { offerId: string; data: any }) =>
      agreementService.reviseRenewalOffer(offerId, payload),
    onSuccess: () => { hmsToast.success('Renewal offer revised'); invalidate(); setReviseRow(null); },
    onError: (err) => hmsToast.fromApiError(err, 'Failed to revise renewal offer'),
  });

  const handleSend = (row: any) => {
    if (!row.latest_offer?.id) return;
    setBusyAgreementId(row.agreement_id);
    sendOfferMutation.mutate({ offerId: row.latest_offer.id, agreementId: row.agreement_id });
  };

  const handleResend = (row: any) => {
    if (!row.latest_offer?.id) return;
    setBusyAgreementId(row.agreement_id);
    resendOfferMutation.mutate({ offerId: row.latest_offer.id, agreementId: row.agreement_id });
  };

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

  // The single-offer sheet still speaks the old queue row shape, so adapt rather
  // than fork it — its room-shift selector needs the tenant's current room.
  const offerSheetRow = useMemo(() => {
    if (!offerRow) return null;
    return {
      current_agreement: {
        id: offerRow.agreement_id,
        agreement_end_date: offerRow.agreement?.agreement_end_date,
        agreement_version: offerRow.agreement?.agreement_version,
        contract: { rent: offerRow.agreement?.rent, security_deposit: offerRow.agreement?.security_deposit },
      },
      tenant: offerRow.tenant,
    };
  }, [offerRow]);

  const currentRoomId = offerRow?.tenant?.room?.id || '';
  const availableRooms = useMemo(
    () =>
      rooms.filter((r: any) => {
        const occupied = Number(r.occupied_count ?? 0);
        const capacity = Number(r.capacity ?? 1);
        return occupied < capacity || r.id === currentRoomId;
      }),
    [rooms, currentRoomId],
  );

  const submitSingleOffer = async (form: { selectedRoomId: string; rent: string; deposit: string; duration: string; notes: string }) => {
    if (!offerRow) return;
    try {
      setIsShifting(true);
      if (form.selectedRoomId && form.selectedRoomId !== currentRoomId) {
        const shiftRes = await allocationService.shift(hostelId, {
          tenant_id: offerRow.tenant?.id,
          new_room_id: form.selectedRoomId,
          shift_date: new Date().toISOString().split('T')[0],
        });
        if (shiftRes?.error || shiftRes?.success === false) throw new Error(shiftRes?.message || 'Failed to shift room');
        hmsToast.success('Room shifted successfully');
      }
      generateSingleMutation.mutate({
        agreementId: offerRow.agreement_id,
        data: {
          proposed_rent: Number(form.rent),
          proposed_security_deposit: Number(form.deposit),
          proposed_duration_months: Number(form.duration),
          owner_notes: form.notes || undefined,
        },
      });
    } catch (err: any) {
      hmsToast.error(err?.message || 'Failed to shift room prior to generating offer');
    } finally {
      setIsShifting(false);
    }
  };

  const submitReviseOffer = (form: { rent: string; deposit: string; duration: string; notes: string }) => {
    if (!reviseRow?.latest_offer?.id) return;
    reviseOfferMutation.mutate({
      offerId: reviseRow.latest_offer.id,
      data: {
        proposed_rent: Number(form.rent),
        proposed_security_deposit: Number(form.deposit),
        proposed_duration_months: Number(form.duration),
        owner_notes: form.notes || undefined,
      },
    });
  };

  const scopedRows = selectedIds.size > 0 ? allRows.filter((r: any) => selectedIds.has(r.agreement_id)) : allRows.filter((r: any) => r.can?.create_offer);
  const bulkQueueRows = scopedRows.map((r: any) => ({
    current_agreement: { id: r.agreement_id, contract: { rent: r.agreement?.rent, security_deposit: r.agreement?.security_deposit } },
    tenant: r.tenant,
  }));

  return (
    <div className="space-y-5 px-4 py-4 sm:px-0 sm:py-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stay Renewals &amp; Negotiations</p>
          <h1 className="text-2xl font-bold text-foreground">Renewal Pipeline</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Every expiring stay and every offer in one place — from needing an offer through to renewed.
          </p>
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
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 sm:h-10"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Renewal Campaigns Wizard</span>
            <span className="sm:hidden">Campaign</span>
          </button>
        </div>
      </header>

      <RenewalPipelineTracker
        stages={[
          {
            key: 'needs_offer',
            label: '1. Needs Offer',
            shortLabel: 'Needs Offer',
            sub: 'No offer sent yet',
            value: Number(counts.NEEDS_OFFER || 0) + Number(counts.DRAFT || 0),
            icon: pipelineIcons.expiring,
            active: stage === 'NEEDS_OFFER',
            onClick: () => setStage(stage === 'NEEDS_OFFER' ? 'ALL' : 'NEEDS_OFFER'),
          },
          {
            key: 'invited',
            label: '2. Invited',
            shortLabel: 'Invited',
            sub: 'Awaiting tenant reply',
            value: Number(counts.INVITED || 0),
            icon: pipelineIcons.draft,
            active: stage === 'INVITED',
            onClick: () => setStage(stage === 'INVITED' ? 'ALL' : 'INVITED'),
          },
          {
            key: 'negotiating',
            label: '3. Under Negotiation',
            shortLabel: 'Negotiating',
            sub: 'Active discussions',
            value: Number(counts.NEGOTIATING || 0),
            icon: pipelineIcons.negotiating,
            active: stage === 'NEGOTIATING',
            onClick: () => setStage(stage === 'NEGOTIATING' ? 'ALL' : 'NEGOTIATING'),
          },
          {
            key: 'renewed',
            label: '4. Renewed (Active/Pending)',
            shortLabel: 'Renewed',
            sub: 'Accepted or finalized',
            value:
              Number(counts.AWAITING_PAYMENT || 0) +
              Number(counts.READY_FOR_SIGNATURE || 0) +
              Number(counts.RENEWAL_DRAFTED || 0) +
              Number(counts.RENEWED || 0),
            icon: pipelineIcons.renewed,
            active: ['AWAITING_PAYMENT', 'READY_FOR_SIGNATURE', 'RENEWAL_DRAFTED', 'RENEWED'].includes(stage),
            onClick: () => setStage(stage === 'READY_FOR_SIGNATURE' ? 'ALL' : 'READY_FOR_SIGNATURE'),
          },
        ]}
      />

      <div className="relative">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {stageChips.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStage(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all sm:py-1.5 ${
                stage === id
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      {(roomGroupings.rooms.length > 0 || roomGroupings.categories.length > 0 || roomGroupings.floors.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <select value={roomNoFilter} onChange={(e) => setRoomNoFilter(e.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground">
            <option value="all">All Rooms</option>
            {roomGroupings.rooms.map((roomNo) => <option key={roomNo} value={roomNo}>Room {roomNo}</option>)}
          </select>
          <select value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground">
            <option value="all">All Room Types</option>
            {roomGroupings.categories.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground">
            <option value="all">All Floors</option>
            {roomGroupings.floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
          </select>
        </div>
      )}

      <RenewalPipelineList
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        rows={visibleRows}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSelectGroup={selectGroup}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkGenerate={() => setShowBulkModal(true)}
        onOpenDetail={(row) => setDetailRowId(row.agreement_id)}
        onCreateOffer={(row) => setOfferRow(row)}
        onSend={handleSend}
        onResend={handleResend}
        onRevise={(row) => setReviseRow(row)}
        busyAgreementId={busyAgreementId}
      />

      {detailRow && (
        <RenewalDetailSheet
          key={detailRow.agreement_id}
          row={detailRow}
          open={Boolean(detailRow)}
          onOpenChange={(next) => !next && closeDetail()}
          onCreateOffer={(row) => { closeDetail(); setOfferRow(row); }}
          onSend={handleSend}
          onResend={handleResend}
          onRevise={(row) => { closeDetail(); setReviseRow(row); }}
          busy={busyAgreementId === detailRow.agreement_id}
        />
      )}

      <BulkCampaignSheet
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        hostelId={hostelId}
        queueRows={bulkQueueRows}
        scopedAgreementIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
        onSubmit={(payload) => generateBulkMutation.mutate(payload)}
        isSubmitting={generateBulkMutation.isPending}
      />

      {offerSheetRow && (
        <SingleOfferSheet
          key={offerRow.agreement_id}
          open={Boolean(offerSheetRow)}
          onOpenChange={(open) => !open && setOfferRow(null)}
          row={offerSheetRow}
          availableRooms={availableRooms}
          onSubmit={submitSingleOffer}
          isSubmitting={generateSingleMutation.isPending || isShifting}
          submittingLabel={isShifting ? 'Shifting Room...' : 'Generating...'}
        />
      )}

      {reviseRow && (
        <ReviseOfferSheet
          key={reviseRow.latest_offer?.id}
          open={Boolean(reviseRow)}
          onOpenChange={(open) => !open && setReviseRow(null)}
          // ReviseOfferSheet renders the tenant name off the offer object; the
          // read model keeps tenant on the row, so re-attach it here.
          offer={{ ...reviseRow.latest_offer, tenant: { profiles: { name: reviseRow.tenant?.name } } }}
          onSubmit={submitReviseOffer}
          isSubmitting={reviseOfferMutation.isPending}
        />
      )}
    </div>
  );
}
