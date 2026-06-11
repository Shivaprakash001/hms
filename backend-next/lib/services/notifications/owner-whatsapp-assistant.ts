import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { dashboardService } from "@/lib/services/dashboard-service";
import { paymentService } from "@/src/services/payments/payment-service";
import { MetaWhatsAppProvider, normalizeWhatsAppPhone } from "./providers/whatsapp/meta-provider";

const logger = getLogger("owner.whatsapp-assistant");

type OwnerIdentity = {
  id: string;
  owner_id: string;
  phone_number: string | null;
};

export type OwnerWhatsAppConnection = {
  id: string;
  phone_number: string;
  verified_at: string | null;
  created_at: string;
};

type HostelRow = {
  id: string;
  name: string;
};

type InboundOwnerResult = {
  handled: boolean;
  ownerId?: string | null;
  command?: string;
  success?: boolean;
};

const HELP_TEXT = [
  "Available Commands",
  "",
  "SUMMARY",
  "DUES",
  "HELP",
  "",
  "More features coming soon.",
].join("\n");

const LINK_SUCCESS_TEXT = [
  "Connected Successfully",
  "",
  "Welcome to Sri Adithya Hostel Assistant",
  "",
  "Available Commands:",
  "",
  "SUMMARY",
  "DUES",
  "HELP",
].join("\n");

const ALREADY_CONNECTED_TEXT = [
  "This WhatsApp number is already connected.",
  "",
  "Available Commands:",
  "",
  "SUMMARY",
  "DUES",
  "HELP",
].join("\n");

function money(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "Rs. 0";
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;
}

function parseCommand(message: string) {
  const normalized = String(message || "").trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();
  const command = upper.split(" ")[0] || "";
  return { normalized, upper, command };
}

export class OwnerWhatsAppAssistantService {
  constructor(private provider?: MetaWhatsAppProvider) {}

  async createLinkCode(ownerId: string) {
    const owner = await prisma.profile.findFirst({
      where: { id: ownerId, role: "OWNER", is_active: true },
      select: { id: true },
    });
    if (!owner) throw new Error("FORBIDDEN: Owner account not found");

    let code = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = `HMS-${crypto.randomInt(1000, 10000)}`;
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM owner_whatsapp_identities
        WHERE link_code = ${code}
        LIMIT 1
      `;
      if (!existing[0]) break;
      code = "";
    }
    if (!code) throw new Error("LINK_CODE_UNAVAILABLE");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.$executeRaw`
      DELETE FROM owner_whatsapp_identities
      WHERE owner_id = ${ownerId}::uuid
        AND is_verified = false
        AND phone_number IS NULL
    `;

    await prisma.$executeRaw`
      INSERT INTO owner_whatsapp_identities (
        owner_id,
        link_code,
        link_code_expires_at,
        is_verified,
        updated_at
      )
      VALUES (
        ${ownerId}::uuid,
        ${code},
        ${expiresAt},
        false,
        now()
      )
    `;

    return {
      link_code: code,
      expires_at: expiresAt.toISOString(),
      expires_in_seconds: 600,
    };
  }

  async listConnections(ownerId: string): Promise<OwnerWhatsAppConnection[]> {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      phone_number: string;
      verified_at: Date | null;
      created_at: Date;
    }>>`
      SELECT id::text, phone_number, verified_at, created_at
      FROM owner_whatsapp_identities
      WHERE owner_id = ${ownerId}::uuid
        AND is_verified = true
        AND phone_number IS NOT NULL
      ORDER BY verified_at DESC NULLS LAST, created_at DESC
    `;

    return rows.map((row: {
      id: string;
      phone_number: string;
      verified_at: Date | null;
      created_at: Date;
    }) => ({
      id: row.id,
      phone_number: row.phone_number,
      verified_at: row.verified_at ? row.verified_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
    }));
  }

  async disconnectConnection(ownerId: string, connectionId: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      phone_number: string;
    }>>`
      DELETE FROM owner_whatsapp_identities
      WHERE id = ${connectionId}::uuid
        AND owner_id = ${ownerId}::uuid
        AND is_verified = true
      RETURNING id::text, phone_number
    `;
    const disconnected = rows[0];
    if (!disconnected) {
      throw new Error("NOT_FOUND: WhatsApp connection not found");
    }

    try {
      await this.getProvider().sendTextMessage(
        disconnected.phone_number,
        "This WhatsApp number has been disconnected from the Sri Adithya Hostel Assistant."
      );
    } catch (error: any) {
      logger.warn("disconnect.notice_failed", {
        owner_id: ownerId,
        connection_id: connectionId,
        error: error?.message || String(error),
      });
    }

    return {
      id: disconnected.id,
      phone_number: disconnected.phone_number,
    };
  }

  async processInboundMessage(phone: string, message: string): Promise<InboundOwnerResult | null> {
    const parsed = parseCommand(message);
    if (!parsed.command) return null;

    const normalizedPhone = normalizeWhatsAppPhone(phone);
    const verifiedIdentity = await this.getVerifiedIdentity(normalizedPhone);

    if (!verifiedIdentity && parsed.command !== "LINK") {
      return null;
    }

    if (parsed.command === "LINK") {
      return this.handleLink(normalizedPhone, parsed.normalized, parsed.command);
    }

    const ownerId = verifiedIdentity?.owner_id;
    if (!ownerId) return null;

    if (parsed.command === "HELP") {
      return this.respondAndLog({
        ownerId,
        phone: normalizedPhone,
        message,
        command: "HELP",
        response: HELP_TEXT,
        success: true,
      });
    }

    if (parsed.command === "SUMMARY") {
      return this.handleSummary(ownerId, normalizedPhone, message);
    }

    if (parsed.command === "DUES") {
      return this.handleDues(ownerId, normalizedPhone, message);
    }

    return this.respondAndLog({
      ownerId,
      phone: normalizedPhone,
      message,
      command: parsed.command || "UNKNOWN",
      response: HELP_TEXT,
      success: true,
    });
  }

  private async handleLink(phone: string, message: string, command: string): Promise<InboundOwnerResult> {
    const code = message.toUpperCase().match(/^LINK\s+(HMS-\d{4})$/)?.[1] || null;
    if (!code) {
      return this.respondAndLog({
        ownerId: null,
        phone,
        message,
        command,
        response: "Send LINK HMS-XXXX from this WhatsApp number after generating a code in HMS.",
        success: false,
      });
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      owner_id: string;
      link_code_expires_at: Date | null;
    }>>`
      SELECT id::text, owner_id::text, link_code_expires_at
      FROM owner_whatsapp_identities
      WHERE link_code = ${code}
      LIMIT 1
    `;
    const identity = rows[0];

    if (!identity || !identity.link_code_expires_at || identity.link_code_expires_at.getTime() < Date.now()) {
      return this.respondAndLog({
        ownerId: identity?.owner_id || null,
        phone,
        message,
        command,
        response: "Link code is invalid or expired. Generate a new code in HMS and try again.",
        success: false,
      });
    }

    const owner = await prisma.profile.findFirst({
      where: { id: identity.owner_id, role: "OWNER", is_active: true },
      select: { id: true },
    });

    if (!owner) {
      return this.respondAndLog({
        ownerId: identity.owner_id,
        phone,
        message,
        command,
        response: "Owner account is not active. Please sign in to HMS and try again.",
        success: false,
      });
    }

    const existingPhoneOwner = await this.getVerifiedIdentity(phone);
    if (existingPhoneOwner && existingPhoneOwner.owner_id !== identity.owner_id) {
      return this.respondAndLog({
        ownerId: identity.owner_id,
        phone,
        message,
        command,
        response: "This WhatsApp number is already linked to another owner account.",
        success: false,
      });
    }

    if (existingPhoneOwner && existingPhoneOwner.owner_id === identity.owner_id) {
      await prisma.$executeRaw`
        DELETE FROM owner_whatsapp_identities
        WHERE id = ${identity.id}::uuid
      `;

      return this.respondAndLog({
        ownerId: identity.owner_id,
        phone,
        message,
        command,
        response: ALREADY_CONNECTED_TEXT,
        success: true,
      });
    }

    await prisma.$executeRaw`
      UPDATE owner_whatsapp_identities
      SET phone_number = ${phone},
          link_code = NULL,
          link_code_expires_at = NULL,
          is_verified = true,
          verified_at = now(),
          updated_at = now()
      WHERE id = ${identity.id}::uuid
    `;

    return this.respondAndLog({
      ownerId: identity.owner_id,
      phone,
      message,
      command,
      response: LINK_SUCCESS_TEXT,
      success: true,
    });
  }

  private async handleSummary(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    try {
      const hostels = await this.getActiveHostels(ownerId);
      if (hostels.length === 0) {
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "SUMMARY",
          response: "No active hostel found for this owner account.",
          success: false,
        });
      }

      const statsRows = await Promise.all(
        hostels.map((hostel) => dashboardService.getOwnerStatsShell(ownerId, hostel.id))
      );
      const totals = statsRows.reduce((acc, stats) => ({
        revenue: acc.revenue + Number(stats.revenue ?? stats.monthly_revenue ?? 0),
        pendingDues: acc.pendingDues + Number(stats.pending_dues || 0),
        expenses: acc.expenses + Number(stats.monthly_expenses ?? stats.expenses_this_month ?? 0),
        occupiedBeds: acc.occupiedBeds + Number(stats.occupied_beds || 0),
        capacity: acc.capacity + Number(stats.total_capacity || 0),
      }), { revenue: 0, pendingDues: 0, expenses: 0, occupiedBeds: 0, capacity: 0 });
      const occupancyRate = totals.capacity > 0
        ? Math.round((totals.occupiedBeds / totals.capacity) * 100)
        : 0;
      const [onlyHostel] = hostels;
      const hostelLabel = hostels.length === 1 && onlyHostel
        ? onlyHostel.name
        : `All Hostels (${hostels.length})`;
      const response = [
        hostelLabel,
        "",
        `Revenue This Month: ${money(totals.revenue)}`,
        `Pending Dues: ${money(totals.pendingDues)}`,
        `Occupancy: ${occupancyRate}% (${totals.occupiedBeds}/${totals.capacity} beds)`,
        `Expenses: ${money(totals.expenses)}`,
      ].join("\n");

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "SUMMARY",
        response,
        success: true,
      });
    } catch (error: any) {
      logger.error("summary.failed", { owner_id: ownerId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "SUMMARY",
        response: "Could not fetch summary right now. Please try again later.",
        success: false,
      });
    }
  }

  private async handleDues(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    try {
      const hostels = await this.getActiveHostels(ownerId);
      if (hostels.length === 0) {
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "DUES",
          response: "No active hostel found for this owner account.",
          success: false,
        });
      }

      const duesByHostel = await Promise.all(
        hostels.map((hostel) => paymentService.getDuesReport(ownerId, hostel.id))
      );
      const dues = duesByHostel.flat();
      const pendingByTenant = new Map<string, {
        name: string;
        room: string;
        amount: number;
      }>();

      for (const due of dues) {
        const outstanding = Number(due.outstanding || 0);
        if (outstanding <= 0) continue;
        const current = pendingByTenant.get(due.tenant_id) || {
          name: due.tenant_name || "Tenant",
          room: due.room_no || "N/A",
          amount: 0,
        };
        current.amount += outstanding;
        pendingByTenant.set(due.tenant_id, current);
      }

      const rows = Array.from(pendingByTenant.values()).sort((a, b) => b.amount - a.amount);
      const topRows = rows.slice(0, 10);
      const totalPending = rows.reduce((sum, row) => sum + row.amount, 0);

      const response = topRows.length > 0
        ? [
            "Top pending tenants",
            "",
            ...topRows.map((row, index) =>
              `${index + 1}. ${row.name} - ${money(row.amount)}${row.room && row.room !== "N/A" ? ` (Room ${row.room})` : ""}`
            ),
            "",
            `Total Pending: ${money(totalPending)}`,
          ].join("\n")
        : [
            "Top pending tenants",
            "",
            "No pending dues found.",
            "",
            "Total Pending: Rs. 0",
          ].join("\n");

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "DUES",
        response,
        success: true,
      });
    } catch (error: any) {
      logger.error("dues.failed", { owner_id: ownerId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "DUES",
        response: "Could not fetch dues right now. Please try again later.",
        success: false,
      });
    }
  }

  private async getVerifiedIdentity(phone: string): Promise<OwnerIdentity | null> {
    try {
      const rows = await prisma.$queryRaw<OwnerIdentity[]>`
        SELECT id::text, owner_id::text, phone_number
        FROM owner_whatsapp_identities
        WHERE phone_number = ${phone}
          AND is_verified = true
        LIMIT 1
      `;
      return rows[0] || null;
    } catch (error: any) {
      if (error?.code === "P2010" && String(error?.meta?.code || "").toUpperCase() === "42P01") {
        logger.warn("identity.table_missing", {
          reason: "owner_whatsapp_identities migration has not been applied",
        });
        return null;
      }
      throw error;
    }
  }

  private async getActiveHostels(ownerId: string): Promise<HostelRow[]> {
    const rows = await prisma.$queryRaw<HostelRow[]>`
      SELECT id::text, name
      FROM hostels
      WHERE owner_id = ${ownerId}::uuid
        AND is_active = true
      ORDER BY name ASC
    `;
    return rows;
  }

  private async respondAndLog(input: {
    ownerId: string | null;
    phone: string;
    message: string;
    command: string;
    response: string;
    success: boolean;
  }): Promise<InboundOwnerResult> {
    let responseSent = false;
    try {
      await this.getProvider().sendTextMessage(input.phone, input.response);
      responseSent = true;
    } catch (error: any) {
      logger.error("response.send_failed", {
        owner_id: input.ownerId,
        command: input.command,
        error: error?.message || String(error),
      });
    }

    const success = input.success && responseSent;
    await this.logMessage({
      ownerId: input.ownerId,
      phone: input.phone,
      message: input.message,
      command: input.command,
      success,
    });

    return {
      handled: true,
      ownerId: input.ownerId,
      command: input.command,
      success,
    };
  }

  private async logMessage(input: {
    ownerId: string | null;
    phone: string;
    message: string;
    command: string;
    success: boolean;
  }) {
    try {
      await prisma.$executeRaw`
        INSERT INTO owner_assistant_messages (
          owner_id,
          phone_number,
          message,
          command,
          success
        )
        VALUES (
          ${input.ownerId}::uuid,
          ${input.phone},
          ${input.message},
          ${input.command},
          ${input.success}
        )
      `;
    } catch (error: any) {
      logger.error("message.log_failed", {
        owner_id: input.ownerId,
        command: input.command,
        error: error?.message || String(error),
      });
    }
  }

  private getProvider() {
    if (!this.provider) {
      this.provider = new MetaWhatsAppProvider();
    }
    return this.provider;
  }
}

export const ownerWhatsAppAssistantService = new OwnerWhatsAppAssistantService();
