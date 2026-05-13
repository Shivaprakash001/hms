export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantMigrationService } from "@/lib/services/tenant-migration-service";
import { bulkImportValidationService } from "@/lib/services/bulk-import-validation-service";
import { prisma } from "@/lib/db";
import { planEnforcementService } from "@/lib/services/plan-enforcement-service";

/**
 * 🚀 Bulk Import - Confirm and Execute
 * POST /api/bulk-import/[batch_id]/confirm
 * Access: Owner/Admin only
 * 
 * Executes the validated bulk import
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { batch_id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Only owners/admins can import tenants", "FORBIDDEN", 403);
  }

  try {
    const batchId = params.batch_id;

    const batch = await prisma.bulkImportBatch.findFirst({
      where: {
        id: batchId,
        owner_id: session.sub,
        status: "VALIDATED",
      },
      include: {
        hostel: true,
      },
    });

    if (!batch) {
      return apiError(
        "Batch not found or already processed",
        "NOT_FOUND",
        404
      );
    }

    await planEnforcementService.assertSubscriptionActive(session.sub);

    const currentTenantCount = await prisma.tenant.count({
      where: {
        owner_id: session.sub,
        status: "ACTIVE",
      },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { owner_id: session.sub },
      include: { plan: true },
    });

    if (!subscription) {
      return apiError("No active subscription found", "FORBIDDEN", 403);
    }

    const tenantLimit = subscription.plan.tenant_limit;
    const projectedTotal = currentTenantCount + batch.valid_rows;

    if (tenantLimit > 0 && projectedTotal > tenantLimit) {
      const overflowEnabled = subscription.plan.overflow_enabled;
      const hardCap = subscription.plan.overflow_hard_cap;

      if (!overflowEnabled || (hardCap > 0 && projectedTotal > hardCap)) {
        return apiError(
          `Cannot import ${batch.valid_rows} tenants. Current: ${currentTenantCount}, Limit: ${tenantLimit}${
            overflowEnabled ? `, Hard cap: ${hardCap}` : ""
          }`,
          "TENANT_LIMIT_EXCEEDED",
          402
        );
      }
    }

    const fileBuffer = Buffer.from("");
    const rows = await bulkImportValidationService.parseFile(
      fileBuffer,
      batch.filename
    );

    const validation = await bulkImportValidationService.validateRows(
      rows,
      batch.hostel_id,
      session.sub
    );

    const validRowsWithData = validation.validRows.map((vr) => ({
      row: vr.row,
      data: vr.data,
    }));

    const result = await tenantMigrationService.bulkImportTenants(
      validRowsWithData,
      session.sub,
      batch.hostel_id,
      batchId
    );

    return apiResponse(
      {
        batch_id: batchId,
        hostel: {
          id: batch.hostel.id,
          name: batch.hostel.name,
        },
        result: {
          total_requested: result.totalRequested,
          success_count: result.successCount,
          failure_count: result.failureCount,
          results: result.results.map((r) => ({
            row: r.row,
            success: r.success,
            tenant_id: r.tenantId,
            error: r.error,
          })),
          errors: result.errors.slice(0, 50),
        },
      },
      200
    );
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to execute import");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400,
      BAD_REQUEST: 400,
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      TENANT_LIMIT_EXCEEDED: 402,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return apiError(normalizedMessage, normalizedCode || "IMPORT_ERROR", status);
  }
}
