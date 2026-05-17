export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantMigrationService } from "@/lib/services/tenant-migration-service";
import { prisma } from "@/lib/db";
import type { TenantImportRow } from "@/lib/services/bulk-import-validation-service";

/**
 * Bulk import batch preview.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { batch_id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Only owners/admins can import tenants", "FORBIDDEN", 403);
  }

  try {
    const batchId = params.batch_id;

    const batch = await prisma.bulk_import_batches.findFirst({
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

    const validationPayload = getValidationPayload(batch.validation_errors);

    return apiResponse(
      {
        batch_id: batch.id,
        filename: batch.filename,
        hostel: {
          id: batch.hostel.id,
          name: batch.hostel.name,
        },
        validation: {
          total_rows: batch.total_rows,
          valid_rows: batch.valid_rows,
          invalid_rows: batch.failed_rows,
          duplicate_rows: batch.duplicate_rows,
          warnings: 0,
        },
        defaults: validationPayload.defaults || {},
        preview: {
          valid: validationPayload.valid_rows.slice(0, 25).map(sanitizeImportRowForPreview),
          invalid: validationPayload.invalid || [],
          duplicates: validationPayload.duplicates || [],
        },
      },
      200
    );
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to load import batch");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return apiError(normalizedMessage, normalizedCode || "BATCH_ERROR", status);
  }
}

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

    const batch = await prisma.bulk_import_batches.findFirst({
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

    const validRowsWithData = getValidationPayload(batch.validation_errors).valid_rows;

    if (!validRowsWithData.length) {
      return apiError("No valid tenant rows are available for this batch", "VALIDATION_ERROR", 400);
    }

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

function getValidationPayload(raw: unknown): {
  defaults?: Record<string, unknown>;
  valid_rows: Array<{ row: number; data: TenantImportRow }>;
  invalid?: Array<Record<string, unknown>>;
  duplicates?: Array<Record<string, unknown>>;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid_rows: [] };
  }

  const payload = raw as Record<string, any>;
  return {
    defaults: payload.defaults,
    valid_rows: Array.isArray(payload.valid_rows) ? payload.valid_rows : [],
    invalid: Array.isArray(payload.invalid) ? payload.invalid : [],
    duplicates: Array.isArray(payload.duplicates) ? payload.duplicates : [],
  };
}

function sanitizeImportRowForPreview(row: { row: number; data: TenantImportRow }) {
  return {
    row: row.row,
    data: {
      name: row.data.name,
      phone: row.data.phone,
      email: row.data.email,
      room_no: row.data.room_no,
      monthly_rent: row.data.monthly_rent,
      advance_deposit: row.data.advance_deposit,
      maintenance_charge: row.data.maintenance_charge,
      maintenance_type: row.data.maintenance_type,
      joining_date: row.data.joining_date,
      billing_start_mode: row.data.billing_start_mode,
      rent_source: row.data.rent_source,
    },
  };
}
