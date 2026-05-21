export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutService } from "@/lib/services/move-out-service";
import { getTenantSteps } from "@/lib/services/move-out-state-machine";
import { MoveOutStatus } from "@prisma/client";

/**
 * GET /api/move-out/timeline — Tenant-facing timeline with steps + events
 * Returns simplified steps (hiding internal complexity) + chronological events.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") return apiError("Forbidden", "FORBIDDEN", 403);

  try {
    const request = await moveOutService.getRequestForTenant(session.sub);
    if (!request) return apiResponse({ active: false, steps: [], events: [] });

    const steps = getTenantSteps(request.status as MoveOutStatus);

    // Build chronological event timeline
    const events: Array<{ timestamp: string; type: string; title: string; detail?: string }> = [];

    events.push({ timestamp: request.created_at.toISOString(), type: "REQUEST", title: "Move-out request submitted", detail: `Planned exit: ${new Date(request.planned_exit_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` });

    if (request.inspection) {
      events.push({ timestamp: request.inspection.inspected_at.toISOString(), type: "INSPECTION", title: "Room inspection completed", detail: `Condition: ${request.inspection.room_condition} | Deductions: ₹${Number(request.inspection.total_deductions || 0).toLocaleString("en-IN")}` });
    }

    if (request.settlement) {
      events.push({ timestamp: request.settlement.created_at.toISOString(), type: "SETTLEMENT", title: "Settlement calculated", detail: `Net: ₹${Math.abs(Number(request.settlement.net_settlement_amount)).toLocaleString("en-IN")} (${request.settlement.settlement_direction === "OWNER_OWES_TENANT" ? "Refund to you" : request.settlement.settlement_direction === "TENANT_OWES_OWNER" ? "Due from you" : "Settled"})` });
      if (request.settlement.settled_at) {
        events.push({ timestamp: request.settlement.settled_at.toISOString(), type: "PAYMENT", title: `Payment ${request.settlement.settlement_direction === "OWNER_OWES_TENANT" ? "refunded" : "received"}`, detail: `Via ${request.settlement.payment_method || "N/A"}${request.settlement.payment_reference ? ` (Ref: ${request.settlement.payment_reference})` : ""}` });
      }
    }

    if (request.disputes?.length) {
      for (const d of request.disputes) {
        events.push({ timestamp: d.created_at.toISOString(), type: "DISPUTE", title: `Dispute raised: ${d.dispute_type}`, detail: d.description });
        if (d.resolved_at) {
          events.push({ timestamp: d.resolved_at.toISOString(), type: "DISPUTE_RESOLVED", title: "Dispute resolved", detail: d.resolution_notes || undefined });
        }
      }
    }

    if ((request as any).completed_at) {
      events.push({ timestamp: (request as any).completed_at.toISOString(), type: "COMPLETED", title: "Move-out completed", detail: "Thank you for staying with us!" });
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return apiResponse({
      active: true,
      request_id: request.id,
      status: request.status,
      steps,
      events,
      settlement: request.settlement ? {
        net_amount: Number(request.settlement.net_settlement_amount),
        direction: request.settlement.settlement_direction,
        payment_status: request.settlement.payment_status,
      } : null,
      disputes: request.disputes ? request.disputes.map(d => ({
        id: d.id,
        dispute_type: d.dispute_type,
        description: d.description,
        status: d.status,
        resolution_notes: d.resolution_notes,
        created_at: d.created_at,
        resolved_at: d.resolved_at
      })) : [],
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch timeline");
  }
}
