import { prisma } from "../db";
import { Prisma, MoveOutStatus, MoveOutReason } from "@prisma/client";
type Tx = Prisma.TransactionClient;
import { getLogger } from "../logger";
import { financialService } from "../../src/services/payments/financial-service";
import { tenantAdvanceService } from "../../src/services/payments/tenant-advance-service";
import { assertTransition, assertCapability, checkCapability, getTenantSteps } from "./move-out-state-machine";
import { notifyMoveOutTransition } from "./move-out-notifications";

// Re-export capability guards for use by other services
export { assertCapability, checkCapability } from "./move-out-state-machine";

const logger = getLogger("move-out");

// ─── Types ─────────────────────────────────────────────────────
export interface CreateMoveOutParams {
  tenantId: string; hostelId: string; ownerId: string;
  initiatedBy: string; initiatedByRole: "TENANT" | "OWNER" | "WARDEN";
  reason: MoveOutReason; reasonText?: string; plannedExitDate: string;
  isEviction?: boolean; evictionReason?: string;
}
export interface InspectionParams {
  requestId: string; inspectedBy: string; roomCondition: string; cleaningStatus: string;
  damagesAmount?: number; cleaningFee?: number; missingItemsFee?: number; otherDeductions?: number;
  deductionNotes?: string; evidenceUrls?: string[]; notes?: string;
  items?: Array<{ itemName: string; itemCategory?: string; condition: string; chargeAmount?: number; notes?: string; evidenceUrl?: string }>;
}
export interface DisputeParams {
  requestId: string; raisedBy: string; raisedByRole: string;
  disputeType: string; description: string; disputedAmount?: number; evidenceUrls?: string[];
}
export interface FeedbackParams {
  requestId: string; tenantId: string; hostelId: string;
  ratingCleanliness?: number; ratingFood?: number; ratingWifi?: number;
  ratingManagement?: number; ratingMaintenance?: number; ratingSafety?: number;
  ratingValue?: number; ratingNoise?: number; overallRating?: number;
  wouldRecommend?: boolean; improvementText?: string; experienceText?: string;
}



// ─── Service ───────────────────────────────────────────────────
export class MoveOutService {

  // ── Create Request ───────────────────────────────────────────
  async createRequest(params: CreateMoveOutParams) {
    const { tenantId, hostelId, ownerId, initiatedBy, initiatedByRole, reason, reasonText, plannedExitDate, isEviction, evictionReason } = params;
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { id: true, status: true, owner_id: true } });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Tenant does not belong to this owner");
    if (tenant.status !== "ACTIVE") throw new Error(`VALIDATION: Only ACTIVE tenants can request move-out. Current: ${tenant.status}`);

    const existing = await prisma.move_out_requests.findFirst({
      where: { tenant_id: tenantId, status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } },
    });
    if (existing) throw new Error(`VALIDATION: Active move-out request already exists (${existing.id})`);

    const hostel = await prisma.hostels.findUnique({ where: { id: hostelId }, select: { preferences_config: true } });
    const noticePeriodDays = ((hostel?.preferences_config as any) || {}).notice_period_days ?? 30;
    const exitDate = new Date(plannedExitDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exitDate.getTime() - today.getTime()) / (86400000));
    const violation = diffDays < noticePeriodDays;

    const request = await prisma.$transaction(async (tx: Tx) => {
      const req = await tx.move_out_requests.create({
        data: {
          tenant_id: tenantId, hostel_id: hostelId, owner_id: ownerId,
          status: "REQUESTED", reason, reason_text: reasonText || null,
          planned_exit_date: exitDate, notice_period_days: noticePeriodDays,
          notice_period_violation: violation, initiated_by: initiatedBy,
          initiated_by_role: initiatedByRole, is_eviction: isEviction || false,
          eviction_reason: evictionReason || null,
        },
      });
      await tx.tenants.update({ where: { id: tenantId }, data: { status: "MOVE_OUT_REQUESTED", updated_at: new Date() } });
      return req;
    });
    logger.info("move_out.created", { id: request.id, tenant_id: tenantId, eviction: isEviction });
    notifyMoveOutTransition(request.id, "REQUESTED");
    return { request, notice_period_violation: violation, notice_period_days: noticePeriodDays };
  }

  // ── Cancel Request ───────────────────────────────────────────
  async cancelRequest(requestId: string, cancelledBy: string, reason?: string) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: requestId } });
    if (!req) throw new Error("NOT_FOUND: Move-out request not found");
    assertTransition(req.status as MoveOutStatus, "CANCELLED");
    return prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.move_out_requests.update({
        where: { id: requestId },
        data: { status: "CANCELLED", cancelled_at: new Date(), cancelled_by: cancelledBy, cancellation_reason: reason || null, updated_at: new Date() },
      });
      await tx.tenants.update({ where: { id: req.tenant_id }, data: { status: "ACTIVE", updated_at: new Date() } });
      notifyMoveOutTransition(requestId, "CANCELLED");
      return updated;
    });
  }

  // ── Submit Inspection ────────────────────────────────────────
  async submitInspection(params: InspectionParams) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: params.requestId } });
    if (!req) throw new Error("NOT_FOUND: Move-out request not found");
    assertTransition(req.status as MoveOutStatus, "INSPECTION_DONE");
    const totalDeductions = (params.damagesAmount || 0) + (params.cleaningFee || 0) + (params.missingItemsFee || 0) + (params.otherDeductions || 0);

    return prisma.$transaction(async (tx: Tx) => {
      const inspection = await tx.move_out_inspections.upsert({
        where: { request_id: params.requestId },
        create: {
          request_id: params.requestId, inspected_by: params.inspectedBy,
          room_condition: params.roomCondition || "GOOD", cleaning_status: params.cleaningStatus || "CLEAN",
          damages_amount: params.damagesAmount || 0, cleaning_fee: params.cleaningFee || 0,
          missing_items_fee: params.missingItemsFee || 0, other_deductions: params.otherDeductions || 0,
          total_deductions: totalDeductions, deduction_notes: params.deductionNotes || null,
          evidence_urls: params.evidenceUrls || [], notes: params.notes || null,
        },
        update: {
          inspected_by: params.inspectedBy, room_condition: params.roomCondition || "GOOD",
          cleaning_status: params.cleaningStatus || "CLEAN", damages_amount: params.damagesAmount || 0,
          cleaning_fee: params.cleaningFee || 0, missing_items_fee: params.missingItemsFee || 0,
          other_deductions: params.otherDeductions || 0, total_deductions: totalDeductions,
          deduction_notes: params.deductionNotes || null, evidence_urls: params.evidenceUrls || [],
          notes: params.notes || null, updated_at: new Date(),
        },
      });
      // Structured inspection items
      if (params.items?.length) {
        await tx.move_out_inspection_items.deleteMany({ where: { request_id: params.requestId } });
        await tx.move_out_inspection_items.createMany({
          data: params.items.map(i => ({
            request_id: params.requestId, item_name: i.itemName,
            item_category: i.itemCategory || "FURNITURE", condition: i.condition,
            charge_amount: i.chargeAmount || 0, notes: i.notes || null, evidence_url: i.evidenceUrl || null,
          })),
        });
      }
      await tx.move_out_requests.update({ where: { id: params.requestId }, data: { status: "INSPECTION_DONE", updated_at: new Date() } });
      notifyMoveOutTransition(params.requestId, "INSPECTION_DONE");
      return inspection;
    });
  }

  // ── Settlement Preview (read-only) ──────────────────────────
  async calculateSettlementPreview(requestId: string) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: requestId }, include: { tenant: true, inspection: true } });
    if (!req) throw new Error("NOT_FOUND: Move-out request not found");

    const securityDeposit = Number(req.tenant.advance_deposit || 0);
    const advBal = await tenantAdvanceService.getBalance(req.tenant_id, req.owner_id);
    const advanceBalance = advBal.balance;
    const dues = await financialService.getTenantDues(req.tenant_id, req.owner_id, req.hostel_id);
    const insp = req.inspection;
    const totalDeductions = Number(insp?.total_deductions || 0);
    const totalDues = dues.rent_due + dues.late_fees_due;
    const net = securityDeposit + advanceBalance - totalDues - totalDeductions;

    return {
      request_id: requestId,
      security_deposit_amount: round2(securityDeposit),
      advance_balance: round2(advanceBalance),
      pending_rent_dues: round2(dues.rent_due),
      pending_late_fees: round2(dues.late_fees_due),
      pending_utility_dues: 0,
      damages_deduction: round2(Number(insp?.damages_amount || 0)),
      cleaning_deduction: round2(Number(insp?.cleaning_fee || 0)),
      missing_items_deduction: round2(Number(insp?.missing_items_fee || 0)),
      other_deductions: round2(Number(insp?.other_deductions || 0)),
      total_deductions: round2(totalDeductions),
      total_dues: round2(totalDues),
      net_settlement_amount: round2(net),
      settlement_direction: net > 0 ? "OWNER_OWES_TENANT" : net < 0 ? "TENANT_OWES_OWNER" : "SETTLED",
    };
  }

  // ── Approve Settlement → PAYMENT_PENDING ────────────────────
  async approveSettlement(requestId: string, approvedBy: string, reviewNotes?: string) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: requestId } });
    if (!req) throw new Error("NOT_FOUND");
    const preview = await this.calculateSettlementPreview(requestId);
    const nextStatus: MoveOutStatus = preview.settlement_direction === "SETTLED" ? "COMPLETED" : "PAYMENT_PENDING";
    assertTransition(req.status as MoveOutStatus, nextStatus);

    return prisma.$transaction(async (tx: Tx) => {
      await tx.exit_settlement_transactions.upsert({
        where: { request_id: requestId },
        create: { request_id: requestId, tenant_id: req.tenant_id, owner_id: req.owner_id, hostel_id: req.hostel_id, ...snapshotFromPreview(preview) },
        update: { ...snapshotFromPreview(preview), updated_at: new Date() },
      });
      const nextStatus: MoveOutStatus = preview.settlement_direction === "SETTLED" ? "COMPLETED" : "PAYMENT_PENDING";
      await tx.move_out_requests.update({
        where: { id: requestId },
        data: {
          status: nextStatus, reviewed_by: approvedBy, reviewed_at: new Date(),
          review_notes: reviewNotes || null, updated_at: new Date(),
          ...(nextStatus === "COMPLETED" ? { financial_completion_date: new Date(), completed_at: new Date() } : {}),
        },
      });

      if (nextStatus === "COMPLETED") {
        await this._executeCompletionSideEffects(tx, req.tenant_id, requestId, req.planned_exit_date, req.reason, req.reason_text, new Date());
      }
      notifyMoveOutTransition(requestId, nextStatus);
      return { ...preview, status: nextStatus };
    });
  }

  // ── Confirm Payment → COMPLETED ─────────────────────────────
  async confirmPaymentAndComplete(params: { requestId: string; settledBy: string; paymentMethod?: string; paymentReference?: string; paymentNotes?: string; physicalExitDate?: string }) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: params.requestId }, include: { settlement: true } });
    if (!req) throw new Error("NOT_FOUND");
    assertTransition(req.status as MoveOutStatus, "COMPLETED");
    const now = new Date();
    const physicalDate = params.physicalExitDate ? new Date(params.physicalExitDate) : req.planned_exit_date;

    return prisma.$transaction(async (tx: Tx) => {
      if (req.settlement) {
        await tx.exit_settlement_transactions.update({
          where: { id: req.settlement.id },
          data: { payment_status: "SETTLED", payment_method: params.paymentMethod || "CASH", payment_reference: params.paymentReference || null, payment_notes: params.paymentNotes || null, settled_at: now, settled_by: params.settledBy, confirmed_by_owner: true, updated_at: now },
        });
      }
      // Resolve any open disputes
      await tx.exit_disputes.updateMany({ where: { request_id: params.requestId, status: "OPEN" }, data: { status: "RESOLVED", resolved_at: now, updated_at: now } });

      await tx.move_out_requests.update({
        where: { id: params.requestId },
        data: { status: "COMPLETED", financial_completion_date: now, physical_exit_date: physicalDate, completed_at: now, updated_at: now },
      });
      // Room release and tenant update
      await this._executeCompletionSideEffects(tx, req.tenant_id, params.requestId, physicalDate, req.reason, req.reason_text, now);
      notifyMoveOutTransition(params.requestId, "COMPLETED");
      return { success: true, request_id: params.requestId, physical_exit_date: physicalDate };
    });
  }

  // ── Raise Dispute ────────────────────────────────────────────
  async raiseDispute(params: DisputeParams) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: params.requestId } });
    if (!req) throw new Error("NOT_FOUND");
    assertTransition(req.status as MoveOutStatus, "DISPUTED");
    return prisma.$transaction(async (tx: Tx) => {
      const dispute = await tx.exit_disputes.create({
        data: { request_id: params.requestId, raised_by: params.raisedBy, raised_by_role: params.raisedByRole, dispute_type: params.disputeType, description: params.description, disputed_amount: params.disputedAmount || null, evidence_urls: params.evidenceUrls || [] },
      });
      await tx.move_out_requests.update({ where: { id: params.requestId }, data: { status: "DISPUTED", updated_at: new Date() } });
      notifyMoveOutTransition(params.requestId, "DISPUTED");
      return dispute;
    });
  }

  private async _executeCompletionSideEffects(tx: Tx, tenantId: string, requestId: string, exitDate: Date, reason: string, reasonText: string | null, now: Date) {
    if (exitDate <= now) {
      await tx.roomAllocation.updateMany({ where: { tenant_id: tenantId, is_active: true, end_date: null }, data: { is_active: false, end_date: exitDate } });
      await tx.move_out_requests.update({ where: { id: requestId }, data: { room_release_date: exitDate } });
      // Reset payment summary so they don't show pending dues in the LEFT state
      const tenant = await tx.tenants.findUnique({ where: { id: tenantId }, select: { payment_summary: true } });
      let paymentSummary = typeof tenant?.payment_summary === 'object' ? tenant.payment_summary : {};
      paymentSummary = { ...paymentSummary, pending_amount: 0, payment_status: 'PAID' };
      
      await tx.tenants.update({
        where: { id: tenantId },
        data: {
          status: "LEFT", exit_date: exitDate, exit_reason: reason, exit_notes: reasonText,
          payment_summary: paymentSummary, updated_at: now
        }
      });
      // Optionally waive all pending obligations so they don't appear in historical debt unless explicitly wanted
      await tx.rent_obligations.updateMany({
        where: { tenant_id: tenantId, status: { in: ["PENDING", "PARTIAL"] } },
        data: { status: "WAIVED", updated_at: now }
      });
    }
  }

  // ── Resolve Dispute ──────────────────────────────────────────
  async resolveDispute(disputeId: string, resolvedBy: string, resolutionNotes: string) {
    const dispute = await prisma.exit_disputes.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new Error("NOT_FOUND");
    return prisma.$transaction(async (tx: Tx) => {
      await tx.exit_disputes.update({ where: { id: disputeId }, data: { status: "RESOLVED", resolved_by: resolvedBy, resolution_notes: resolutionNotes, resolved_at: new Date(), updated_at: new Date() } });
      const openCount = await tx.exit_disputes.count({ where: { request_id: dispute.request_id, status: "OPEN", id: { not: disputeId } } });
      if (openCount === 0) {
        await tx.move_out_requests.update({ where: { id: dispute.request_id }, data: { status: "PAYMENT_PENDING", updated_at: new Date() } });
        notifyMoveOutTransition(dispute.request_id, "PAYMENT_PENDING");
      }
      return { resolved: true, remaining_disputes: openCount };
    });
  }

  // ── Submit Feedback ──────────────────────────────────────────
  async submitFeedback(params: FeedbackParams) {
    const req = await prisma.move_out_requests.findUnique({ where: { id: params.requestId } });
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "COMPLETED") throw new Error("VALIDATION: Feedback only after completion");
    const existing = await prisma.exit_feedbacks.findUnique({ where: { request_id: params.requestId } });
    if (existing) throw new Error("VALIDATION: Feedback already submitted");
    const c = (v?: number) => v != null ? Math.max(1, Math.min(5, v)) : null;
    return prisma.exit_feedbacks.create({
      data: {
        request_id: params.requestId, tenant_id: params.tenantId, hostel_id: params.hostelId,
        rating_cleanliness: c(params.ratingCleanliness), rating_food: c(params.ratingFood),
        rating_wifi: c(params.ratingWifi), rating_management: c(params.ratingManagement),
        rating_maintenance: c(params.ratingMaintenance), rating_safety: c(params.ratingSafety),
        rating_value: c(params.ratingValue), rating_noise: c(params.ratingNoise),
        overall_rating: c(params.overallRating), would_recommend: params.wouldRecommend ?? null,
        improvement_text: params.improvementText || null, experience_text: params.experienceText || null,
      },
    });
  }

  // ── Queries ──────────────────────────────────────────────────
  async getRequestById(requestId: string) {
    const r = await prisma.move_out_requests.findUnique({
      where: { id: requestId },
      include: {
        inspection: true, inspection_items: true, settlement: true, feedback: true,
        disputes: { orderBy: { created_at: "desc" } },
        tenant: { include: { profiles: { select: { name: true, email: true, phone: true } }, room_allocations: { where: { is_active: true }, include: { room: { select: { room_no: true, floor: true } } }, take: 1 } } },
      },
    });
    if (!r) throw new Error("NOT_FOUND");
    return r;
  }

  async listRequests(params: { ownerId: string; hostelId: string; status?: string; limit?: number; offset?: number }) {
    const where: any = { owner_id: params.ownerId, hostel_id: params.hostelId };
    if (params.status) where.status = params.status;
    const [requests, total] = await Promise.all([
      prisma.move_out_requests.findMany({
        where, include: {
          tenant: { include: { profiles: { select: { name: true } }, room_allocations: { where: { is_active: true }, include: { room: { select: { room_no: true } } }, take: 1 } } },
          settlement: { select: { net_settlement_amount: true, payment_status: true, settlement_direction: true } },
        }, orderBy: { created_at: "desc" }, take: params.limit || 50, skip: params.offset || 0,
      }),
      prisma.move_out_requests.count({ where }),
    ]);
    return { requests, total };
  }

  async getRequestForTenant(profileId: string) {
    const tenant = await prisma.tenants.findUnique({ where: { profile_id: profileId }, select: { id: true } });
    if (!tenant) throw new Error("NOT_FOUND");
    return prisma.move_out_requests.findFirst({
      where: { tenant_id: tenant.id, status: { notIn: ["CANCELLED", "REJECTED"] } },
      include: { inspection: true, settlement: true, feedback: true, disputes: true },
      orderBy: { created_at: "desc" },
    });
  }

  // ── Vacancy Pipeline ─────────────────────────────────────────
  async getUpcomingVacancies(ownerId: string, hostelId: string, daysAhead = 30) {
    return prisma.move_out_requests.findMany({
      where: {
        owner_id: ownerId, hostel_id: hostelId,
        status: { in: ["REQUESTED", "INSPECTION_PENDING", "INSPECTION_DONE", "SETTLEMENT_APPROVED", "PAYMENT_PENDING"] },
        planned_exit_date: { lte: new Date(Date.now() + daysAhead * 86400000) },
      },
      include: { tenant: { include: { profiles: { select: { name: true } }, room_allocations: { where: { is_active: true }, include: { room: { select: { room_no: true, floor: true } } }, take: 1 } } } },
      orderBy: { planned_exit_date: "asc" },
    });
  }

  // ── Churn Analytics (deep) ───────────────────────────────────
  async getChurnAnalytics(ownerId: string, hostelId: string) {
    const [reasonBreakdown, monthlyExits, avgStay, roomChurn, feedbackAvgs] = await Promise.all([
      prisma.move_out_requests.groupBy({ by: ["reason"], where: { owner_id: ownerId, hostel_id: hostelId, status: "COMPLETED" }, _count: true, orderBy: { _count: { reason: "desc" } } }),
      prisma.$queryRaw<Array<{ month: string; count: number }>>`SELECT TO_CHAR(completed_at,'YYYY-MM') AS month, COUNT(*)::int AS count FROM move_out_requests WHERE owner_id=${ownerId}::uuid AND hostel_id=${hostelId}::uuid AND status='COMPLETED' AND completed_at >= NOW()-INTERVAL '12 months' GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ avg_days: number }>>`SELECT COALESCE(AVG(EXTRACT(DAY FROM (mor.completed_at-t.joined_on))),0)::float AS avg_days FROM move_out_requests mor JOIN tenants t ON t.id=mor.tenant_id WHERE mor.owner_id=${ownerId}::uuid AND mor.hostel_id=${hostelId}::uuid AND mor.status='COMPLETED' AND t.joined_on IS NOT NULL`,
      prisma.$queryRaw<Array<{ room_no: string; count: number }>>`SELECT r.room_no, COUNT(*)::int AS count FROM move_out_requests mor JOIN tenants t ON t.id=mor.tenant_id JOIN room_allocations ra ON ra.tenant_id=t.id JOIN rooms r ON r.id=ra.room_id WHERE mor.owner_id=${ownerId}::uuid AND mor.hostel_id=${hostelId}::uuid AND mor.status='COMPLETED' GROUP BY r.room_no ORDER BY count DESC LIMIT 10`,
      prisma.$queryRaw<Array<{ dim: string; avg: number }>>`SELECT unnest(ARRAY['cleanliness','food','wifi','management','maintenance','safety','value','noise']) AS dim, unnest(ARRAY[AVG(rating_cleanliness),AVG(rating_food),AVG(rating_wifi),AVG(rating_management),AVG(rating_maintenance),AVG(rating_safety),AVG(rating_value),AVG(rating_noise)])::float AS avg FROM exit_feedbacks WHERE hostel_id=${hostelId}::uuid`,
    ]);

    const vacancies = await this.getUpcomingVacancies(ownerId, hostelId);

    return {
      reason_breakdown: reasonBreakdown.map((r: any) => ({ reason: r.reason, count: r._count })),
      monthly_exits: monthlyExits,
      average_stay_days: Math.round(avgStay[0]?.avg_days || 0),
      room_churn_hotspots: roomChurn,
      feedback_averages: feedbackAvgs,
      upcoming_vacancies: vacancies.map((v: any) => ({
        request_id: v.id, tenant_name: v.tenant?.profiles?.name || "Unknown",
        room_no: v.tenant?.room_allocations?.[0]?.room?.room_no || null,
        planned_exit_date: v.planned_exit_date, status: v.status,
      })),
    };
  }
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function snapshotFromPreview(p: any) {
  return {
    security_deposit_amount: p.security_deposit_amount, advance_balance: p.advance_balance,
    pending_rent_dues: p.pending_rent_dues, pending_late_fees: p.pending_late_fees,
    pending_utility_dues: p.pending_utility_dues, damages_deduction: p.damages_deduction,
    cleaning_deduction: p.cleaning_deduction, missing_items_deduction: p.missing_items_deduction,
    other_deductions: p.other_deductions, total_deductions: p.total_deductions,
    total_dues: p.total_dues, net_settlement_amount: p.net_settlement_amount,
    settlement_direction: p.settlement_direction,
  };
}

export const moveOutService = new MoveOutService();
