import * as XLSX from "xlsx";
import { prisma } from "../db";
import { getLogger } from "../logger";

const logger = getLogger("bulk-import-validation");

export interface TenantImportRow {
  name: string;
  phone: string;
  email?: string;
  room_no: string;
  monthly_rent: number | undefined;
  advance_deposit?: number;
  maintenance_charge?: number;
  maintenance_type?: "MONTHLY" | "ONE_TIME" | "NONE";
  joining_date?: string;
  onboarding_password: string;
  profile_type?: string;
  emergency_contact?: string;
  gender?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface ValidatedRow {
  row: number;
  data: TenantImportRow;
  errors: ValidationError[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
}

export interface ValidationResult {
  totalRows: number;
  validRows: ValidatedRow[];
  invalidRows: ValidatedRow[];
  duplicates: ValidatedRow[];
  summary: {
    valid: number;
    invalid: number;
    duplicates: number;
    warnings: number;
  };
}

const MAX_IMPORT_ROWS = 150;

export class BulkImportValidationService {
  async parseFile(fileBuffer: Buffer, filename: string): Promise<TenantImportRow[]> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new Error("VALIDATION_ERROR: Excel file is empty or has no sheets");
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rawData.length > MAX_IMPORT_ROWS) {
        throw new Error(`Import file too large. Maximum ${MAX_IMPORT_ROWS} rows allowed. Your file has ${rawData.length} rows. Please split into multiple files.`);
      }

      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
        raw: false,
        defval: "",
      });

      if (!jsonData || jsonData.length === 0) {
        throw new Error("VALIDATION_ERROR: No data rows found in the file");
      }

      return this.normalizeRows(jsonData);
    } catch (error: any) {
      if (error.message.includes("VALIDATION_ERROR")) {
        throw error;
      }
      logger.error("Failed to parse import file", {
        filename,
        error: String(error),
      });
      throw new Error("VALIDATION_ERROR: Failed to parse file. Please ensure it's a valid Excel or CSV file.");
    }
  }

  private normalizeRows(rawData: any[]): TenantImportRow[] {
    return rawData.map((row) => ({
      name: String(row.name || row.Name || row.NAME || "").trim(),
      phone: String(row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || "").trim(),
      email: String(row.email || row.Email || row.EMAIL || "").trim() || undefined,
      room_no: String(row.room_no || row.room || row.Room || row.ROOM || row.room_number || "").trim(),
      monthly_rent: this.parseNumber(row.monthly_rent || row.rent || row.Rent || row.RENT || 0),
      advance_deposit: this.parseNumber(row.advance_deposit || row.advance || row.Advance || row.ADVANCE),
      maintenance_charge: this.parseNumber(row.maintenance_charge || row.maintenance || row.Maintenance),
      maintenance_type: this.normalizeMaintenanceType(row.maintenance_type),
      joining_date: String(row.joining_date || row.join_date || row.date || "").trim() || undefined,
      onboarding_password: String(row.onboarding_password || row.password || row.Password || "").trim(),
      profile_type: String(row.profile_type || row.type || "STUDENT").trim(),
      emergency_contact: String(row.emergency_contact || row.emergency || "").trim() || undefined,
      gender: String(row.gender || row.Gender || "").trim() || undefined,
    }));
  }

  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    const num = Number(String(value).replace(/[^0-9.-]/g, ""));
    return isNaN(num) ? undefined : num;
  }

  private normalizeMaintenanceType(value: any): "MONTHLY" | "ONE_TIME" | "NONE" | undefined {
    if (!value) return undefined;
    const normalized = String(value).toUpperCase().trim();
    if (["MONTHLY", "ONE_TIME", "NONE"].includes(normalized)) {
      return normalized as "MONTHLY" | "ONE_TIME" | "NONE";
    }
    return undefined;
  }

  async validateRows(
    rows: TenantImportRow[],
    hostelId: string,
    ownerId: string
  ): Promise<ValidationResult> {
    const validatedRows: ValidatedRow[] = [];
    const existingPhones = await this.getExistingPhones(ownerId);
    const existingEmails = await this.getExistingEmails(ownerId);
    const hostelRooms = await this.getHostelRooms(hostelId);
    const phonesSeen = new Set<string>();
    const emailsSeen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const errors: ValidationError[] = [];
      const warnings: string[] = [];
      let isDuplicate = false;
      let duplicateReason: string | undefined;

      if (!row.name || row.name.length < 2) {
        errors.push({
          row: rowNumber,
          field: "name",
          message: "Name is required and must be at least 2 characters",
          value: row.name,
        });
      }

      const normalizedPhone = this.normalizePhone(row.phone);
      if (!normalizedPhone) {
        errors.push({
          row: rowNumber,
          field: "phone",
          message: "Valid phone number is required (10 digits)",
          value: row.phone,
        });
      } else {
        if (existingPhones.has(normalizedPhone)) {
          isDuplicate = true;
          duplicateReason = `Phone number ${normalizedPhone} already exists in system`;
        } else if (phonesSeen.has(normalizedPhone)) {
          isDuplicate = true;
          duplicateReason = `Phone number ${normalizedPhone} appears multiple times in this file`;
        } else {
          phonesSeen.add(normalizedPhone);
        }
      }

      if (row.email) {
        const normalizedEmail = row.email.toLowerCase();
        if (!this.isValidEmail(normalizedEmail)) {
          errors.push({
            row: rowNumber,
            field: "email",
            message: "Invalid email format",
            value: row.email,
          });
        } else if (existingEmails.has(normalizedEmail)) {
          isDuplicate = true;
          duplicateReason = `Email ${normalizedEmail} already exists in system`;
        } else if (emailsSeen.has(normalizedEmail)) {
          isDuplicate = true;
          duplicateReason = `Email ${normalizedEmail} appears multiple times in this file`;
        } else {
          emailsSeen.add(normalizedEmail);
        }
      } else {
        warnings.push("Email not provided - tenant will use phone-based login only");
      }

      if (!row.room_no) {
        errors.push({
          row: rowNumber,
          field: "room_no",
          message: "Room number is required",
          value: row.room_no,
        });
      } else {
        const room = hostelRooms.find((r) => r.room_no === row.room_no);
        if (!room) {
          errors.push({
            row: rowNumber,
            field: "room_no",
            message: `Room ${row.room_no} not found in hostel`,
            value: row.room_no,
          });
        } else if (!room.is_active) {
          warnings.push(`Room ${row.room_no} is inactive`);
        } else {
          const currentOccupancy = room._count.allocations;
          if (currentOccupancy >= room.capacity) {
            errors.push({
              row: rowNumber,
              field: "room_no",
              message: `Room ${row.room_no} is full (${currentOccupancy}/${room.capacity})`,
              value: row.room_no,
            });
          }
        }
      }

      if (!row.monthly_rent || row.monthly_rent <= 0) {
        errors.push({
          row: rowNumber,
          field: "monthly_rent",
          message: "Monthly rent must be greater than 0",
          value: row.monthly_rent,
        });
      }

      if (!row.onboarding_password || row.onboarding_password.length < 6) {
        errors.push({
          row: rowNumber,
          field: "onboarding_password",
          message: "Onboarding password must be at least 6 characters",
          value: row.onboarding_password ? "***" : undefined,
        });
      } else if (!this.isValidPassword(row.onboarding_password)) {
        errors.push({
          row: rowNumber,
          field: "onboarding_password",
          message: "Password must contain at least one letter and one number",
          value: "***",
        });
      }

      if (row.joining_date) {
        const date = this.parseDate(row.joining_date);
        if (!date) {
          errors.push({
            row: rowNumber,
            field: "joining_date",
            message: "Invalid date format (use YYYY-MM-DD or DD/MM/YYYY)",
            value: row.joining_date,
          });
        }
      }

      if (row.maintenance_type && !["MONTHLY", "ONE_TIME", "NONE"].includes(row.maintenance_type)) {
        errors.push({
          row: rowNumber,
          field: "maintenance_type",
          message: "Maintenance type must be MONTHLY, ONE_TIME, or NONE",
          value: row.maintenance_type,
        });
      }

      validatedRows.push({
        row: rowNumber,
        data: { ...row, phone: normalizedPhone || row.phone },
        errors,
        warnings,
        isDuplicate,
        duplicateReason,
      });
    }

    const validRows = validatedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate);
    const invalidRows = validatedRows.filter((r) => r.errors.length > 0);
    const duplicates = validatedRows.filter((r) => r.isDuplicate);

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicates,
      summary: {
        valid: validRows.length,
        invalid: invalidRows.length,
        duplicates: duplicates.length,
        warnings: validatedRows.reduce((sum, r) => sum + r.warnings.length, 0),
      },
    };
  }

  private normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 13 && cleaned.startsWith("091")) {
      return `+${cleaned.substring(1)}`;
    }
    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPassword(password: string): boolean {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
  }

  private parseDate(dateStr: string): Date | null {
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
    return null;
  }

  private async getExistingPhones(ownerId: string): Promise<Set<string>> {
    const profiles = await prisma.profile.findMany({
      where: {
        owner_id: ownerId,
        role: "TENANT",
        phone: { not: null },
      },
      select: { phone: true },
    });
    return new Set(profiles.map((p) => p.phone!).filter(Boolean));
  }

  private async getExistingEmails(ownerId: string): Promise<Set<string>> {
    const profiles = await prisma.profile.findMany({
      where: {
        owner_id: ownerId,
        role: "TENANT",
      },
      select: { email: true },
    });
    return new Set(profiles.map((p) => p.email.toLowerCase()));
  }

  private async getHostelRooms(hostelId: string): Promise<Array<{ id: string; room_no: string; is_active: boolean; capacity: number; _count: { allocations: number } }>> {
    const hostelRooms = await prisma.room.findMany({
      where: { hostel_id: hostelId },
      select: {
        id: true,
        room_no: true,
        is_active: true,
        capacity: true,
        _count: {
          select: {
            allocations: {
              where: { is_active: true }
            }
          }
        }
      },
    });
    return hostelRooms;
  }
}

export const bulkImportValidationService = new BulkImportValidationService();
