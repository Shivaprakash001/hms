import { prisma } from "../db";
import { hashPassword } from "../auth";
import crypto from "crypto";
import { getLogger } from "../logger";
import { eventSystem } from "../events";
import { allocationReconciliationService } from "./allocation-reconciliation-service";
import { hostelBillingPreferencesService } from "./hostel-billing-preferences-service";
import type { TenantImportRow } from "./bulk-import-validation-service";

const logger = getLogger("tenant-migration-service");

export interface ImportResult {
  success: boolean;
  tenantId?: string;
  profileId?: string;
  allocationId?: string;
  error?: string;
  row: number;
}

export interface BulkImportResult {
  batchId: string;
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: ImportResult[];
  errors: string[];
}

export class TenantMigrationService {
  async createMigrationTenant(
    data: TenantImportRow,
    ownerId: string,
    hostelId: string,
    batchId: string,
    rowNumber: number
  ): Promise<ImportResult> {
    try {
      const normalizedPhone = data.phone;
      const normalizedEmail = data.email ? data.email.toLowerCase() : `tenant+${normalizedPhone}@system.local`;

      const room = await prisma.rooms.findFirst({
        where: {
          hostel_id: hostelId,
          room_no: data.room_no,
          is_active: true,
        },
        include: { hostel: true },
      });

      if (!room || !room.hostel) {
        return {
          success: false,
          error: `Room ${data.room_no} not found`,
          row: rowNumber,
        };
      }

      const joiningDate = data.joining_date
        ? this.parseDate(data.joining_date)
        : new Date();
      joiningDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const billingStartDate = data.billing_start_mode === "IMPORT_DATE"
        ? today
        : joiningDate;

      const inviteDefaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(
        room.id,
        ownerId
      );
      const resolved = inviteDefaults.resolved_values;

      const monthlyRent = Number(room.base_rent || resolved.monthly_rent);
      const advanceAmount = data.advance_deposit ?? resolved.advance_deposit;
      const maintenanceType = (data.maintenance_type || resolved.maintenance_type) as "MONTHLY" | "ONE_TIME" | "NONE";
      const maintenanceAmount = maintenanceType === "NONE"
        ? 0
        : (data.maintenance_charge ?? resolved.maintenance_charge);

      if (!monthlyRent || monthlyRent <= 0) {
        return {
          success: false,
          error: "Monthly rent must be greater than zero",
          row: rowNumber,
        };
      }

      const hashedOnboardingPassword = data.onboarding_password_hash || await hashPassword(data.onboarding_password);

      const onboardingExpiresAt = new Date();
      onboardingExpiresAt.setDate(onboardingExpiresAt.getDate() + 30);

      const { obligationEngine } = await import("../../src/services/payments/obligation-engine");

      const result = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${room.id}::uuid FOR UPDATE`;

        const currentOccupancy = await tx.roomAllocation.count({
          where: {
            room_id: room.id,
            is_active: true,
          },
        });

        if (currentOccupancy >= room.capacity) {
          throw new Error(`Room ${data.room_no} is full (${currentOccupancy}/${room.capacity})`);
        }

        const profile = await tx.profile.create({
          data: {
            id: crypto.randomUUID(),
            email: normalizedEmail,
            name: data.name,
            phone: normalizedPhone,
            role: "TENANT",
            password_hash: hashedOnboardingPassword,
            is_active: true,
            password_reset_required: true,
            is_imported: true,
            import_batch_id: batchId,
            onboarding_expires_at: onboardingExpiresAt,
            owner_id: ownerId,
            emergency_contact: data.emergency_contact,
          },
        });

        const tenant = await tx.tenants.create({
          data: {
            id: crypto.randomUUID(),
            profile_id: profile.id,
            owner_id: ownerId,
            hostel_id: hostelId,
            monthly_rent: monthlyRent,
            joined_on: joiningDate,
            billing_start_date: billingStartDate,
            status: "ACTIVE",
            advance_deposit: advanceAmount,
            maintenance_charge: maintenanceAmount,
            maintenance_type: maintenanceType,
            profile_type: data.profile_type || "STUDENT",
            gender: data.gender,
          } as any,
        });

        const allocation = await tx.roomAllocation.create({
          data: {
            id: crypto.randomUUID(),
            tenant_id: tenant.id,
            room_id: room.id,
            hostel_id: hostelId,
            start_date: joiningDate,
            is_active: true,
          },
        });

        const obligations = await obligationEngine.createInitialObligations(tx, {
          tenantId: tenant.id,
          allocationId: allocation.id,
          ownerId,
          hostelId,
          joiningDate,
          billingStartDate,
          monthlyRent,
          createRent: true,
          advanceDeposit: advanceAmount,
          maintenanceCharge: maintenanceAmount,
          maintenanceType: maintenanceType,
        });

        return {
          profile,
          tenant,
          allocation,
          obligations,
        };
      });

      await allocationReconciliationService
        .reconcileAllocation(result.allocation.id)
        .catch((err: any) => {
          logger.error("reconcile_after_migration_import_failed", {
            allocation_id: result.allocation.id,
            tenant_id: result.tenant.id,
            error: String(err?.message || err),
          });
        });

      await eventSystem.trigger("tenant_created", {
        tenant_id: result.tenant.id,
        email: normalizedEmail,
        owner_id: ownerId,
        creator_id: ownerId,
        source: "BULK_IMPORT",
        batch_id: batchId,
      });

      logger.info("Successfully created migration tenant", {
        tenant_id: result.tenant.id,
        profile_id: result.profile.id,
        batch_id: batchId,
        row: rowNumber,
      });

      return {
        success: true,
        tenantId: result.tenant.id,
        profileId: result.profile.id,
        allocationId: result.allocation.id,
        row: rowNumber,
      };
    } catch (error: any) {
      logger.error("Failed to create migration tenant", {
        error: String(error?.message || error),
        row: rowNumber,
        phone: data.phone,
      });

      let errorMessage = "Unknown error occurred";
      if (error?.code === "P2002") {
        if (error.meta?.target?.includes("email")) {
          errorMessage = `Email ${data.email} already exists`;
        } else if (error.meta?.target?.includes("phone")) {
          errorMessage = `Phone ${data.phone} already exists`;
        } else {
          errorMessage = "Duplicate record detected";
        }
      } else {
        errorMessage = error?.message || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
        row: rowNumber,
      };
    }
  }

  async bulkImportTenants(
    validRows: Array<{ row: number; data: TenantImportRow }>,
    ownerId: string,
    hostelId: string,
    batchId: string
  ): Promise<BulkImportResult> {
    const results: ImportResult[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    logger.info(`Starting bulk import of ${validRows.length} tenants`, {
      batch_id: batchId,
      owner_id: ownerId,
      hostel_id: hostelId,
    });

    await prisma.bulk_import_batches.update({
      where: { id: batchId },
      data: {
        status: "IMPORTING",
        validated_at: new Date(),
      },
    });

    for (const { row, data } of validRows) {
      const result = await this.createMigrationTenant(
        data,
        ownerId,
        hostelId,
        batchId,
        row
      );

      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (result.error) {
          errors.push(`Row ${row}: ${result.error}`);
        }
      }
    }

    await prisma.bulk_import_batches.update({
      where: { id: batchId },
      data: {
        status: successCount > 0 ? "COMPLETED" : "FAILED",
        imported_rows: successCount,
        failed_rows: failureCount,
        imported_at: new Date(),
        import_summary: {
          success: successCount,
          failed: failureCount,
          errors: errors.slice(0, 100),
        },
      },
    });

    logger.info(`Bulk import completed`, {
      batch_id: batchId,
      total: validRows.length,
      success: successCount,
      failed: failureCount,
    });

    return {
      batchId,
      totalRequested: validRows.length,
      successCount,
      failureCount,
      results,
      errors,
    };
  }

  private parseDate(dateStr: string): Date {
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        if (format === formats[0]) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return new Date();
  }
}

export const tenantMigrationService = new TenantMigrationService();
