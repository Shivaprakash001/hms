import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, Coins, DoorClosed, Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@shared/ui';
import { deriveRoomGroupings } from './utils';

type Strategy = 'FLAT' | 'PERCENTAGE' | 'ROOM_CATEGORY' | 'FLOOR_WISE' | 'ROOM_WISE';

export function BulkCampaignSheet({
  open,
  onOpenChange,
  hostelId,
  queueRows,
  scopedAgreementIds,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string;
  queueRows: any[];
  scopedAgreementIds?: string[];
  onSubmit: (payload: Record<string, unknown>) => void;
  isSubmitting: boolean;
}) {
  const { categories: uniqueCategories, floors: uniqueFloors } = useMemo(() => deriveRoomGroupings(queueRows), [queueRows]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Map<string, number>();
    queueRows.forEach((row: any) => {
      const roomNo = row.tenant?.room?.room_no;
      if (!roomNo) return;
      const agreement = row.current_agreement || {};
      rooms.set(roomNo, Number(agreement.contract?.rent ?? agreement.contract_rent ?? 0));
    });
    return Array.from(rooms.entries());
  }, [queueRows]);

  const [title, setTitle] = useState(
    () => `Renewal Campaign - ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
  );
  const [strategy, setStrategy] = useState<Strategy>('FLAT');
  const [duration, setDuration] = useState('11');
  const [flatRent, setFlatRent] = useState('');
  const [flatDeposit, setFlatDeposit] = useState('');
  const [percent, setPercent] = useState('5');
  const [categoryRents, setCategoryRents] = useState<Record<string, string>>({});
  const [floorRents, setFloorRents] = useState<Record<string, string>>({});
  const [roomRents, setRoomRents] = useState<Record<string, string>>({});

  const rowTerms = useMemo(
    () =>
      queueRows.map((row: any) => {
        const agreement = row.current_agreement || {};
        return {
          roomType: row.tenant?.room?.room_type || '',
          floorName: row.tenant?.room?.floor_name || '',
          roomNo: row.tenant?.room?.room_no || '',
          currentRent: Number(agreement.contract?.rent ?? agreement.contract_rent ?? 0),
        };
      }),
    [queueRows],
  );

  const preview = useMemo(() => {
    let matched: { currentRent: number; proposedRent: number }[] = [];

    if (strategy === 'FLAT') {
      const rent = Number(flatRent);
      if (rent > 0) matched = rowTerms.map((r) => ({ currentRent: r.currentRent, proposedRent: rent }));
    } else if (strategy === 'PERCENTAGE') {
      const pct = Number(percent);
      if (pct > 0) matched = rowTerms.map((r) => ({ currentRent: r.currentRent, proposedRent: Math.round(r.currentRent * (1 + pct / 100)) }));
    } else if (strategy === 'ROOM_CATEGORY') {
      matched = rowTerms
        .filter((r) => r.roomType && Number(categoryRents[r.roomType]) > 0)
        .map((r) => ({ currentRent: r.currentRent, proposedRent: Number(categoryRents[r.roomType]) }));
    } else if (strategy === 'FLOOR_WISE') {
      matched = rowTerms
        .filter((r) => r.floorName && Number(floorRents[r.floorName]) > 0)
        .map((r) => ({ currentRent: r.currentRent, proposedRent: Number(floorRents[r.floorName]) }));
    } else {
      matched = rowTerms
        .filter((r) => r.roomNo && Number(roomRents[r.roomNo]) > 0)
        .map((r) => ({ currentRent: r.currentRent, proposedRent: Number(roomRents[r.roomNo]) }));
    }

    const matchedCount = matched.length;
    const totalCurrent = matched.reduce((sum, r) => sum + r.currentRent, 0);
    const totalProposed = matched.reduce((sum, r) => sum + r.proposedRent, 0);
    const monthlyImpact = totalProposed - totalCurrent;
    const avgDelta = matchedCount > 0 ? Math.round(monthlyImpact / matchedCount) : 0;

    return {
      matchedCount,
      skippedCount: Math.max(0, queueRows.length - matchedCount),
      monthlyImpact,
      avgDelta,
    };
  }, [strategy, flatRent, percent, categoryRents, floorRents, roomRents, rowTerms, queueRows.length]);

  const canSubmit = useMemo(() => {
    if (!duration) return false;
    if (strategy === 'FLAT') return Boolean(flatRent);
    if (strategy === 'PERCENTAGE') return Boolean(percent);
    if (strategy === 'ROOM_CATEGORY') return Object.values(categoryRents).some((v) => v);
    if (strategy === 'FLOOR_WISE') return Object.values(floorRents).some((v) => v);
    return Object.values(roomRents).some((v) => v);
  }, [strategy, duration, flatRent, percent, categoryRents, floorRents, roomRents]);

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      hostelId,
      renewal_strategy: strategy,
      proposed_duration_months: Number(duration),
      title,
    };
    if (strategy === 'FLAT') {
      payload.proposed_rent = Number(flatRent);
      if (flatDeposit) payload.proposed_deposit = Number(flatDeposit);
    } else if (strategy === 'PERCENTAGE') {
      payload.rent_increase_percent = Number(percent);
    } else if (strategy === 'ROOM_CATEGORY') {
      const parsed: Record<string, number> = {};
      Object.entries(categoryRents).forEach(([cat, val]) => {
        if (val) parsed[cat] = Number(val);
      });
      payload.category_rents = parsed;
    } else if (strategy === 'FLOOR_WISE') {
      const parsed: Record<string, number> = {};
      Object.entries(floorRents).forEach(([floor, val]) => {
        if (val) parsed[floor] = Number(val);
      });
      payload.floor_rents = parsed;
    } else {
      const parsed: Record<string, number> = {};
      Object.entries(roomRents).forEach(([room, val]) => {
        if (val) parsed[room] = Number(val);
      });
      payload.room_rents = parsed;
    }
    if (scopedAgreementIds?.length) {
      payload.filterCriteria = { agreementIds: scopedAgreementIds };
    }
    onSubmit(payload);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Renewal Campaigns Wizard</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {scopedAgreementIds?.length
              ? `Configure a pricing strategy for the ${scopedAgreementIds.length} tenant${scopedAgreementIds.length === 1 ? '' : 's'} you selected — the estimate below updates as you type.`
              : 'Configure a pricing strategy for expiring stays — the estimate below updates as you type.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {/* Live preview — sticky within the scroll body so it stays visible while configuring */}
          <div className="sticky top-0 z-10 -mx-5 -mt-4 grid grid-cols-3 gap-px border-b border-border bg-border px-5 pb-3 pt-4">
            <div className="bg-card px-3 py-2 text-center">
              <p className="text-lg font-extrabold tabular-nums text-foreground">{preview.matchedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Will get offers</p>
            </div>
            <div className="bg-card px-3 py-2 text-center">
              <p className={`text-lg font-extrabold tabular-nums ${preview.avgDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : preview.avgDelta < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                {preview.avgDelta > 0 ? '+' : ''}₹{preview.avgDelta.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Avg rent change</p>
            </div>
            <div className="bg-card px-3 py-2 text-center">
              <p className="text-lg font-extrabold tabular-nums text-foreground">
                {preview.monthlyImpact >= 0 ? '+' : '-'}₹{Math.abs(preview.monthlyImpact).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Monthly impact</p>
            </div>
          </div>
          {preview.skippedCount > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              {preview.skippedCount} of {queueRows.length} {scopedAgreementIds?.length ? 'selected tenants' : 'expiring stays'} won't get an offer with the current configuration.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {scopedAgreementIds?.length
              ? 'Estimate based on the tenants you selected — actual results may differ slightly once the campaign runs.'
              : 'Estimate based on the stays currently in your queue view — actual results may differ slightly once the campaign runs.'}
          </p>

          {/* Campaign title */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Campaign Name / Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Strategy selection */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Renewal Strategy</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <StrategyButton icon={<Coins className="h-5 w-5 text-accent" />} label="FLAT" sub="Fixed Rent/Deposit" active={strategy === 'FLAT'} onClick={() => setStrategy('FLAT')} />
              <StrategyButton icon={<RefreshCw className="h-5 w-5 text-accent" />} label="PERCENT" sub="Rent % Increase" active={strategy === 'PERCENTAGE'} onClick={() => setStrategy('PERCENTAGE')} />
              <StrategyButton icon={<Users className="h-5 w-5 text-accent" />} label="CATEGORY" sub="Price by Room Type" active={strategy === 'ROOM_CATEGORY'} onClick={() => setStrategy('ROOM_CATEGORY')} />
              <StrategyButton icon={<Building2 className="h-5 w-5 text-accent" />} label="FLOOR" sub="Price by Floor" active={strategy === 'FLOOR_WISE'} onClick={() => setStrategy('FLOOR_WISE')} />
              <StrategyButton icon={<DoorClosed className="h-5 w-5 text-accent" />} label="ROOM" sub="Price by Room No." active={strategy === 'ROOM_WISE'} onClick={() => setStrategy('ROOM_WISE')} />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
            {strategy === 'FLAT' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-foreground">Proposed Monthly Rent (₹) *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 8500"
                    value={flatRent}
                    onChange={(e) => setFlatRent(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground">Proposed Security Deposit (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Leave blank to match current"
                    value={flatDeposit}
                    onChange={(e) => setFlatDeposit(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            )}

            {strategy === 'PERCENTAGE' && (
              <div>
                <label className="text-xs font-bold text-foreground">Proposed Rent Increase Percentage (%) *</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="h-11 w-24 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">Applied to every matching expiring agreement.</span>
                </div>
              </div>
            )}

            {strategy === 'ROOM_CATEGORY' && (
              <div className="space-y-3">
                <h4 className="mb-1 block text-xs font-bold text-foreground">Set Rents for Room Categories *</h4>
                {uniqueCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground">No room categories found in the queue. Add categories and rents manually:</p>
                )}
                <div className="space-y-2">
                  {uniqueCategories.map((cat) => (
                    <div key={cat} className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-foreground">{cat} Category:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">₹</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 9500"
                          value={categoryRents[cat] || ''}
                          onChange={(e) => setCategoryRents({ ...categoryRents, [cat]: e.target.value })}
                          className="h-10 w-32 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const catName = prompt('Enter room category name (e.g. AC, Non-AC):');
                      if (catName && catName.trim()) {
                        setCategoryRents({ ...categoryRents, [catName.trim().toUpperCase()]: '' });
                      }
                    }}
                    className="mt-2 flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Custom Category Mapping
                  </button>
                </div>
              </div>
            )}

            {strategy === 'FLOOR_WISE' && (
              <div className="space-y-3">
                <h4 className="mb-1 block text-xs font-bold text-foreground">Set Rents by Floor *</h4>
                {uniqueFloors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No floor data found in the queue — rooms may not be assigned to a floor yet.</p>
                ) : (
                  <div className="space-y-2">
                    {uniqueFloors.map((floor) => (
                      <div key={floor} className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-foreground">{floor}:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g. 9000"
                            value={floorRents[floor] || ''}
                            onChange={(e) => setFloorRents({ ...floorRents, [floor]: e.target.value })}
                            className="h-10 w-32 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {strategy === 'ROOM_WISE' && (
              <div className="space-y-3">
                <h4 className="mb-1 block text-xs font-bold text-foreground">Set Rents by Room *</h4>
                {uniqueRooms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rooms found in the queue.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {uniqueRooms.map(([roomNo, currentRent]) => (
                      <div key={roomNo} className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-foreground">
                          Room {roomNo} <span className="font-normal text-muted-foreground">(now ₹{currentRent.toLocaleString('en-IN')})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">₹</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g. 8600"
                            value={roomRents[roomNo] || ''}
                            onChange={(e) => setRoomRents({ ...roomRents, [roomNo]: e.target.value })}
                            className="h-10 w-32 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-foreground">Proposed Agreement Duration (Months) *</label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-5 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Launch Campaign{preview.matchedCount > 0 ? ` · ${preview.matchedCount} Offers` : ''}
              </>
            )}
          </button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function StrategyButton({ icon, label, sub, active, onClick }: { icon: React.ReactNode; label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-20 flex-col items-center justify-center rounded-lg border-2 p-3 text-center transition-all ${
        active ? 'border-accent bg-accent/5 font-bold text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="mt-1 text-sm">{label}</span>
      <span className="mt-0.5 text-[10px] font-normal text-muted-foreground">{sub}</span>
    </button>
  );
}
