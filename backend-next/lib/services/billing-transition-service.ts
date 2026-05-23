import { prisma } from "@/lib/db";
import { billingScheduleService, type PaymentFrequency } from "@/lib/services/billing-schedule-service";
import { settlementPreviewService } from "@/lib/services/settlement-preview-service";
import { hostelPolicyService } from "@/lib/services/hostel-policy-service";

function dayBefore(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1));
}

function money(value: unknown) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export class BillingTransitionService {
  private async getPolicy(hostelId: string) {
    const response = await hostelPolicyService.getHostelPolicy(hostelId).catch(() => null);
    return billingScheduleService.normalizePolicy(response?.policy);
  }

  async createRequest(profileId: string, data: { requested_frequency: string; reason?: string }) {
    if (!billingScheduleService.isSupportedFrequency(data.requested_frequency)) {
      throw new Error("UNSUPPORTED_PAYMENT_FREQUENCY");
    }
    const requestedFrequency = data.requested_frequency as PaymentFrequency;
    if (!billingScheduleService.exposedFrequencies().includes(requestedFrequency)) {
      throw new Error("CUSTOM_INSTALLMENTS_NOT_AVAILABLE_IN_V1");
    }

    const tenant = await prisma.tenants.findFirst({
      where: { profile_id: profileId },
      include: {
        payment_frequency_change_requests: { where: { status: "PENDING" }, take: 1 },
        rent_obligations: { include: { payments: true } },
        tenant_billing_plans: { where: { status: "ACTIVE" }, orderBy: { effective_from: "desc" }, take: 1 },
      },
    });
    if (!tenant) throw new Error("TENANT_NOT_FOUND");
    if (!tenant.owner_id) throw new Error("TENANT_OWNER_CONTEXT_MISSING");
    if (tenant.status !== "ACTIVE") throw new Error("ONLY_ACTIVE_TENANTS_CAN_CHANGE_FREQUENCY");
    if (tenant.payment_frequency_change_requests?.length) throw new Error("PENDING_FREQUENCY_CHANGE_EXISTS");

    const currentFrequency = (tenant.payment_frequency || "MONTHLY") as PaymentFrequency;
    if (currentFrequency === requestedFrequency) throw new Error("REQUESTED_FREQUENCY_ALREADY_ACTIVE");

    const policy = await this.getPolicy(tenant.hostel_id);
    if (!policy.allowed_frequencies.includes(requestedFrequency)) throw new Error("FREQUENCY_NOT_ALLOWED_BY_HOSTEL");

    await this.validateCooldown(tenant.id, policy.frequency_change_cooldown_days);

    const effectiveFrom = billingScheduleService.getNextCleanBillingPeriodDate(new Date(), requestedFrequency, policy);
    await this.validateCleanPeriod(tenant.id, effectiveFrom, requestedFrequency, policy);
    await this.validateCommitment(tenant, currentFrequency, policy);

    const preview = await settlementPreviewService.buildFrequencyChangePreview({
      tenantId: tenant.id,
      requestedFrequency,
      effectiveFrom,
      policy,
    });

    return prisma.payment_frequency_change_requests.create({
      data: {
        tenant_id: tenant.id,
        owner_id: tenant.owner_id,
        hostel_id: tenant.hostel_id,
        current_frequency: currentFrequency,
        requested_frequency: requestedFrequency,
        effective_from: effectiveFrom,
        transition_strategy: "NEXT_BILLING_PERIOD",
        reason: data.reason?.trim() || null,
        settlement_snapshot: preview.settlement_snapshot,
        projection_snapshot: preview.projection_snapshot,
        risk_snapshot: preview.risk_snapshot,
      },
    });
  }

  async listForTenant(profileId: string) {
    const tenant = await prisma.tenants.findFirst({ where: { profile_id: profileId }, select: { id: true } });
    if (!tenant) throw new Error("TENANT_NOT_FOUND");
    return prisma.payment_frequency_change_requests.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
      take: 20,
    });
  }

  async listForOwner(ownerId: string, filters: { hostelId?: string; tenantId?: string; status?: string }) {
    return prisma.payment_frequency_change_requests.findMany({
      where: {
        owner_id: ownerId,
        ...(filters.hostelId ? { hostel_id: filters.hostelId } : {}),
        ...(filters.tenantId ? { tenant_id: filters.tenantId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        tenants: {
          select: {
            id: true,
            profiles: { select: { name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async approve(requestId: string, ownerId: string) {
    const request = await prisma.payment_frequency_change_requests.findFirst({
      where: { id: requestId, owner_id: ownerId },
      include: { tenants: true },
    });
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new Error("REQUEST_ALREADY_DECIDED");

    const policy = await this.getPolicy(request.hostel_id);
    await this.validateCleanPeriod(request.tenant_id, request.effective_from, request.requested_frequency, policy);

    const schedule = billingScheduleService.previewSchedule({
      frequency: request.requested_frequency,
      startDate: request.effective_from,
      monthlyRent: money(request.tenants.monthly_rent),
      maintenanceAmount: String(request.tenants.maintenance_type || "MONTHLY") === "MONTHLY" ? money(request.tenants.maintenance_charge) : 0,
      periods: 4,
      policy,
    });
    const totalContractAmount = schedule.reduce((sum, item) => sum + item.amount + item.maintenance_amount, 0);

    return prisma.$transaction(async (tx: any) => {
      await tx.tenant_billing_plans.updateMany({
        where: { tenant_id: request.tenant_id, status: "ACTIVE" },
        data: { status: "SUPERSEDED", effective_to: dayBefore(request.effective_from), updated_at: new Date() },
      });
      const plan = await tx.tenant_billing_plans.create({
        data: {
          tenant_id: request.tenant_id,
          owner_id: request.owner_id,
          hostel_id: request.hostel_id,
          frequency: request.requested_frequency,
          effective_from: request.effective_from,
          installment_count: schedule.length,
          total_contract_amount: money(totalContractAmount),
          transition_strategy: request.transition_strategy,
          schedule_snapshot: schedule,
          status: "ACTIVE",
          approved_by: ownerId,
          approved_at: new Date(),
        },
      });
      await tx.tenants.update({
        where: { id: request.tenant_id },
        data: {
          payment_frequency: request.requested_frequency,
          payment_frequency_effective_from: request.effective_from,
          payment_frequency_updated_at: new Date(),
        },
      });
      const updatedRequest = await tx.payment_frequency_change_requests.update({
        where: { id: request.id },
        data: { status: "APPROVED", approved_by: ownerId, approved_at: new Date(), updated_at: new Date() },
      });
      return { request: updatedRequest, billing_plan: plan };
    });
  }

  async reject(requestId: string, ownerId: string, rejectionReason?: string) {
    const request = await prisma.payment_frequency_change_requests.findFirst({
      where: { id: requestId, owner_id: ownerId },
    });
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new Error("REQUEST_ALREADY_DECIDED");
    return prisma.payment_frequency_change_requests.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejection_reason: rejectionReason?.trim() || null,
        updated_at: new Date(),
      },
    });
  }

  async validateCleanPeriod(tenantId: string, effectiveFrom: Date, requestedFrequency: PaymentFrequency, policy: any) {
    const requestedPeriod = billingScheduleService.getPeriodForAnchor(effectiveFrom, requestedFrequency, policy);
    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        is_superseded: false,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: { payments: true },
    });
    const blockers = obligations.filter((ob: any) => {
      const paid = (ob.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
      const remaining = Math.max(Number(ob.amount || 0) - paid, 0);
      if (remaining <= 0) return false;
      const periodStart = new Date(ob.billing_period_start || ob.rent_month);
      const periodEnd = new Date(ob.billing_period_end || ob.rent_month);
      const beforeEffective = periodEnd < effectiveFrom;
      const overlapsNewWindow = periodStart <= requestedPeriod.end && periodEnd >= requestedPeriod.start;
      return beforeEffective || overlapsNewWindow;
    });
    if (blockers.length) throw new Error("UNCLEAN_BILLING_PERIOD");
  }

  private async validateCooldown(tenantId: string, cooldownDays: number) {
    const latest = await prisma.payment_frequency_change_requests.findFirst({
      where: { tenant_id: tenantId, status: "APPROVED" },
      orderBy: { approved_at: "desc" },
    });
    if (!latest?.approved_at) return;
    const nextAllowed = new Date(latest.approved_at.getTime() + cooldownDays * 86_400_000);
    if (nextAllowed > new Date()) throw new Error("FREQUENCY_CHANGE_COOLDOWN_ACTIVE");
  }

  private async validateCommitment(tenant: any, currentFrequency: PaymentFrequency, policy: any) {
    const activePlan = tenant.tenant_billing_plans?.[0];
    if (!activePlan) return;
    const commitmentMonths = Number(policy.minimum_commitment_months?.[currentFrequency] || 1);
    const effectiveFrom = activePlan.effective_from;
    const minUntil = new Date(Date.UTC(
      effectiveFrom.getUTCFullYear(),
      effectiveFrom.getUTCMonth() + commitmentMonths,
      effectiveFrom.getUTCDate()
    ));
    if (minUntil > new Date()) throw new Error("MINIMUM_COMMITMENT_NOT_MET");
  }
}

export const billingTransitionService = new BillingTransitionService();
