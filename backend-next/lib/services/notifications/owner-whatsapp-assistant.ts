import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { dashboardService } from "@/lib/services/dashboard-service";
import { expenseService } from "@/lib/services/expense-service";
import { moveOutService } from "@/lib/services/move-out-service";
import { financialService } from "@/src/services/payments/financial-service";
import { paymentService } from "@/src/services/payments/payment-service";
import { reminderService } from "@/src/services/payments/reminder-service";
import { tenantService } from "@/src/services/tenants/tenant-service";
import { MetaWhatsAppProvider, normalizeWhatsAppPhone } from "./providers/whatsapp/meta-provider";
import type { WhatsAppButton, WhatsAppListSection } from "./providers/whatsapp/types";
import {
  getSelectionState,
  setSelectionState,
  deleteSelectionState,
  InviteTenantSessionState,
  OwnerMoveOutDateState,
} from "./whatsapp-selection-state";
import { normalizeIndianPhone } from "@/lib/utils/phone-utils";
import { tenantInvitationLifecycleService } from "@/src/services/tenants/tenant-invitation-lifecycle-service";
import { roomCapacityService } from "@/lib/services/room-capacity-service";
import { hostelBillingPreferencesService } from "@/lib/services/hostel-billing-preferences-service";
import { MoveOutReason } from "@prisma/client";

const logger = getLogger("owner.whatsapp-assistant");

interface ParsedInvite {
  raw: string;
  name?: string;
  phone?: string;
  tokens: string[];
}

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
  last_seen_at: string | null;
  last_command: string | null;
};

type HostelRow = {
  id: string;
  name: string;
};

type PendingTenantDues = {
  tenantId: string;
  name: string;
  room: string;
  amount: number;
};

type PendingDuesResult = {
  hostels: HostelRow[];
  rows: PendingTenantDues[];
  totalPending: number;
};

type SendRemindersPayload = {
  action: "SEND_REMINDERS";
  tenantIds: string[];
  tenantCount: number;
  totalPending: number;
  createdAt: string;
};

type CreateExpensePayload = {
  action: "CREATE_EXPENSE";
  title: string;
  amount: number;
  date: string;
  category: string;
  payment_method: string;
  vendor_name?: string;
  raw_command: string;
  template_key?: string;
  phone_number: string;
  createdAt: string;
};

type UndoExpensePayload = {
  action: "UNDO_EXPENSE";
  expense_id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  phone_number: string;
  createdAt: string;
};

type DisconnectWhatsAppPayload = {
  action: "DISCONNECT_WHATSAPP";
  identity_id: string;
  phone_number: string;
  createdAt: string;
};

type StartMoveOutPayload = {
  action: "START_MOVE_OUT";
  tenant_id: string;
  hostel_id: string;
  planned_exit_date: string;
  phone_number: string;
  createdAt: string;
};

type EntitySearchResult = {
  type: "TENANT" | "ROOM" | "LEAD" | "HOSTEL";
  id: string;
  label: string;
  description: string;
  priority: number;
};

type InboundOwnerResult = {
  handled: boolean;
  ownerId?: string | null;
  command?: string;
  success?: boolean;
};

const SEND_REMINDERS_ACTION = "SEND_REMINDERS";
const CREATE_EXPENSE_ACTION = "CREATE_EXPENSE";
const UNDO_EXPENSE_ACTION = "UNDO_EXPENSE";
const DISCONNECT_WHATSAPP_ACTION = "DISCONNECT_WHATSAPP";
const START_MOVE_OUT_ACTION = "START_MOVE_OUT";
const CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;
const EXPENSE_UNDO_WINDOW_MS = 30 * 60 * 1000;
const EXPENSE_REPORT_LIMIT = 5;
const EXPENSE_DRAFT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const EXPENSE_DRAFT_RATE_LIMIT_MAX = 15;
const ENTITY_SEARCH_LIMIT = 10;

const HELP_TEXT = [
  "Available Commands",
  "",
  "SUMMARY",
  "DUES",
  "EXPENSES TODAY",
  "INTERNET 1000",
  "UNDO EXPENSE",
  "CONNECTED",
  "DISCONNECT",
  "SEND REMINDERS",
  "INVITE",
  "HELP",
  "",
  "Reply CONFIRM or CANCEL when confirming an action.",
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
  "EXPENSES TODAY",
  "INTERNET 1000",
  "UNDO EXPENSE",
  "CONNECTED",
  "DISCONNECT",
  "SEND REMINDERS",
  "INVITE",
  "HELP",
].join("\n");

const ALREADY_CONNECTED_TEXT = [
  "This WhatsApp number is already connected.",
  "",
  "Available Commands:",
  "",
  "SUMMARY",
  "DUES",
  "EXPENSES TODAY",
  "INTERNET 1000",
  "UNDO EXPENSE",
  "CONNECTED",
  "DISCONNECT",
  "SEND REMINDERS",
  "INVITE",
  "HELP",
].join("\n");

const EXPENSE_TEMPLATE_ALIASES: Record<string, string> = {
  internet: "Internet",
  wifi: "Internet",
  broadband: "Internet",
  jio: "Internet",
  airtel: "Internet",
  salary: "Staff Salary",
  wages: "Staff Salary",
  staff: "Staff Salary",
  gas: "Gas Cylinders",
  cylinder: "Gas Cylinders",
  lpg: "Gas Cylinders",
  electricity: "Electricity",
  current: "Electricity",
  eb: "Electricity",
  power: "Electricity",
  water: "Water",
  tanker: "Water",
  milk: "Food & Groceries",
  rice: "Food & Groceries",
  groceries: "Food & Groceries",
  grocery: "Food & Groceries",
  food: "Food & Groceries",
  plumber: "Maintenance & Repairs",
  repair: "Maintenance & Repairs",
  repairs: "Maintenance & Repairs",
  maintenance: "Maintenance & Repairs",
};

const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  cash: "cash",
  upi: "upi",
  gpay: "upi",
  phonepe: "upi",
  paytm: "upi",
  card: "card",
  bank: "bank",
  transfer: "bank",
  neft: "bank",
  imps: "bank",
};

function money(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "₹0";
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;
}

function displayWhatsAppPhone(phone: string) {
  const clean = String(phone || "").replace(/[^0-9]/g, "");
  if (!clean) return phone || "Unknown number";
  if (clean.startsWith("91") && clean.length === 12) return `+91 ${clean.slice(2)}`;
  return `+${clean}`;
}

function maskWhatsAppPhone(phone: string) {
  const clean = String(phone || "").replace(/[^0-9]/g, "");
  if (!clean) return phone || "Unknown number";
  const local = clean.startsWith("91") && clean.length === 12 ? clean.slice(2) : clean.slice(-10);
  if (local.length < 6) return displayWhatsAppPhone(clean);
  return `+91 XXXXX${local.slice(-5)}`;
}

function formatConnectionDate(value: string | Date | null | undefined) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(date);
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function parseCommand(message: string) {
  const normalized = String(message || "").trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();
  const command = upper.split(" ")[0] || "";
  return { normalized, upper, command };
}

function isSendRemindersCommand(upper: string) {
  return upper === "SEND REMINDERS" || upper === "SEND REMINDER";
}

function normalizeSendRemindersPayload(payload: any): SendRemindersPayload | null {
  if (!payload || payload.action !== SEND_REMINDERS_ACTION) return null;
  const tenantIds = Array.isArray(payload.tenantIds)
    ? payload.tenantIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (tenantIds.length === 0) return null;
  return {
    action: SEND_REMINDERS_ACTION,
    tenantIds,
    tenantCount: Number(payload.tenantCount || tenantIds.length),
    totalPending: Number(payload.totalPending || 0),
    createdAt: String(payload.createdAt || new Date().toISOString()),
  };
}

function normalizeCreateExpensePayload(payload: any): CreateExpensePayload | null {
  if (!payload || payload.action !== CREATE_EXPENSE_ACTION) return null;
  const amount = Number(payload.amount || 0);
  if (!payload.title || !Number.isFinite(amount) || amount <= 0 || !payload.category) return null;
  return {
    action: CREATE_EXPENSE_ACTION,
    title: String(payload.title),
    amount,
    date: String(payload.date || new Date().toISOString().slice(0, 10)),
    category: String(payload.category),
    payment_method: String(payload.payment_method || "cash"),
    vendor_name: payload.vendor_name ? String(payload.vendor_name) : undefined,
    raw_command: String(payload.raw_command || ""),
    template_key: payload.template_key ? String(payload.template_key) : undefined,
    phone_number: String(payload.phone_number || ""),
    createdAt: String(payload.createdAt || new Date().toISOString()),
  };
}

function normalizeUndoExpensePayload(payload: any): UndoExpensePayload | null {
  if (!payload || payload.action !== UNDO_EXPENSE_ACTION) return null;
  const amount = Number(payload.amount || 0);
  if (!payload.expense_id || !payload.title || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    action: UNDO_EXPENSE_ACTION,
    expense_id: String(payload.expense_id),
    title: String(payload.title),
    amount,
    category: String(payload.category || "Miscellaneous"),
    date: String(payload.date || ""),
    phone_number: String(payload.phone_number || ""),
    createdAt: String(payload.createdAt || new Date().toISOString()),
  };
}

function normalizeDisconnectWhatsAppPayload(payload: any): DisconnectWhatsAppPayload | null {
  if (!payload || payload.action !== DISCONNECT_WHATSAPP_ACTION) return null;
  if (!payload.identity_id || !payload.phone_number) return null;
  return {
    action: DISCONNECT_WHATSAPP_ACTION,
    identity_id: String(payload.identity_id),
    phone_number: String(payload.phone_number),
    createdAt: String(payload.createdAt || new Date().toISOString()),
  };
}

function normalizeStartMoveOutPayload(payload: any): StartMoveOutPayload | null {
  if (!payload || payload.action !== START_MOVE_OUT_ACTION) return null;
  if (!payload.tenant_id || !payload.hostel_id || !payload.planned_exit_date || !payload.phone_number) return null;
  return {
    action: START_MOVE_OUT_ACTION,
    tenant_id: String(payload.tenant_id),
    hostel_id: String(payload.hostel_id),
    planned_exit_date: String(payload.planned_exit_date),
    phone_number: String(payload.phone_number),
    createdAt: String(payload.createdAt || new Date().toISOString()),
  };
}

function parseOwnerAssistantPayload(message: string): { action: string; id?: string } | null {
  const normalized = String(message || "").trim();
  const match = normalized.match(/^([A-Z_]+):([0-9a-fA-F-]{36}|MORE)$/);
  if (!match) return null;
  return { action: match[1], id: match[2] };
}

function parseIsoDateOnly(message: string): string | null {
  const raw = String(message || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== raw) return null;
  return raw;
}

function normalizeSearchText(message: string) {
  return String(message || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s+.-]/gu, "");
}

function titleCase(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeExpenseTemplateKey(input: string) {
  return String(input || "").trim().toLowerCase();
}

function categoryForExpenseToken(token: string) {
  return EXPENSE_TEMPLATE_ALIASES[normalizeExpenseTemplateKey(token)] || null;
}

function paymentMethodForToken(token: string) {
  return PAYMENT_METHOD_ALIASES[String(token || "").trim().toLowerCase()] || null;
}

function formatExpenseTitle(category: string, templateKey: string, vendorName?: string) {
  const base = category || titleCase(templateKey) || "Expense";
  if (!vendorName) return base;
  if (category === "Staff Salary") return `${base} - ${vendorName}`;
  return `${base} - ${vendorName}`;
}

export function parseOwnerExpenseWriteCommand(message: string): CreateExpensePayload | null {
  const normalized = String(message || "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 2) return null;

  const first = tokens[0]?.toLowerCase() || "";
  const isExplicitExpense = first === "expense";
  const bodyTokens = isExplicitExpense ? tokens.slice(1) : tokens;
  if (bodyTokens.length < 2) return null;

  const firstBody = bodyTokens[0]?.toLowerCase() || "";
  if (!isExplicitExpense && !categoryForExpenseToken(firstBody)) return null;

  const amountIndex = bodyTokens.findIndex((token) => {
    const cleaned = token.replace(/[,₹]/g, "");
    return /^\d+(\.\d{1,2})?$/.test(cleaned) && Number(cleaned) > 0;
  });
  if (amountIndex <= 0) return null;

  const amount = Number(bodyTokens[amountIndex].replace(/[,₹]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const beforeAmount = bodyTokens.slice(0, amountIndex);
  const afterAmount = bodyTokens.slice(amountIndex + 1);
  const templateKey = normalizeExpenseTemplateKey(beforeAmount[0] || "");
  const category = categoryForExpenseToken(templateKey) || "Miscellaneous";

  let payment_method = "cash";
  const vendorTokens: string[] = [];
  for (const token of [...beforeAmount.slice(1), ...afterAmount]) {
    const method = paymentMethodForToken(token);
    if (method) {
      payment_method = method;
      continue;
    }
    vendorTokens.push(token);
  }

  const vendor_name = vendorTokens.length > 0 ? titleCase(vendorTokens.join(" ")) : undefined;
  const title = formatExpenseTitle(category, templateKey, vendor_name);

  return {
    action: CREATE_EXPENSE_ACTION,
    title,
    amount,
    date: new Date().toISOString().slice(0, 10),
    category,
    payment_method,
    vendor_name,
    raw_command: normalized,
    template_key: templateKey || undefined,
    phone_number: "",
    createdAt: new Date().toISOString(),
  };
}

function isExpenseReportCommand(parsed: ReturnType<typeof parseCommand>) {
  return parsed.command === "EXPENSES" || parsed.upper === "LAST 5 EXPENSES" || parsed.upper === "TOP CATEGORIES";
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
      last_seen_at: Date | null;
      last_command: string | null;
    }>>`
      SELECT
        i.id::text,
        i.phone_number,
        i.verified_at,
        i.created_at,
        m.created_at AS last_seen_at,
        m.command AS last_command
      FROM owner_whatsapp_identities i
      LEFT JOIN LATERAL (
        SELECT created_at, command
        FROM owner_assistant_messages
        WHERE owner_id = i.owner_id
          AND phone_number = i.phone_number
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      WHERE i.owner_id = ${ownerId}::uuid
        AND i.is_verified = true
        AND i.phone_number IS NOT NULL
      ORDER BY i.verified_at DESC NULLS LAST, i.created_at DESC
    `;

    return rows.map((row: {
      id: string;
      phone_number: string;
      verified_at: Date | null;
      created_at: Date;
      last_seen_at: Date | null;
      last_command: string | null;
    }) => ({
      id: row.id,
      phone_number: row.phone_number,
      verified_at: row.verified_at ? row.verified_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
      last_seen_at: row.last_seen_at ? row.last_seen_at.toISOString() : null,
      last_command: row.last_command || null,
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

    await this.notifyDisconnectedNumber(ownerId, disconnected.phone_number);
    await this.notifyOwnerConnections(ownerId, this.buildConnectionChangedNotice({
      event: "disconnected",
      phone: disconnected.phone_number,
      connectedCount: await this.countConnections(ownerId),
    }), [disconnected.phone_number]);

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

    const cleanMsgLower = message.trim().toLowerCase();
    if (cleanMsgLower.startsWith("invite")) {
      return this.handleStructuredInviteCommand(ownerId, normalizedPhone, message);
    }

    const selectionState = await getSelectionState(normalizedPhone);
    if (selectionState && selectionState.action === "INVITE_TENANT") {
      return this.handleInviteTenantStateFlow(ownerId, normalizedPhone, message, selectionState);
    }

    if (selectionState && selectionState.action === "OWNER_MOVE_OUT_DATE") {
      return this.handleMoveOutDateResponse(ownerId, normalizedPhone, message, selectionState);
    }

    const assistantPayload = parseOwnerAssistantPayload(message);
    if (assistantPayload) {
      return this.handleOwnerAssistantPayload(ownerId, normalizedPhone, message, assistantPayload);
    }

    const cleanMsg = message.trim();
    const isQuickAction = cleanMsg.includes("⚡ Quick Action") || cleanMsg.toUpperCase() === "⚡ QUICK ACTION";
    const isViewDues = cleanMsg.includes("⚠️ View Dues") || cleanMsg.toUpperCase() === "⚠️ VIEW DUES";

    if (isQuickAction || isViewDues) {
      const latestBriefing = await prisma.owner_daily_briefings.findFirst({
        where: { owner_id: ownerId },
        orderBy: { created_at: "desc" },
      });

      if (!latestBriefing) {
        return this.respondAndLog({
          ownerId,
          phone: normalizedPhone,
          message,
          command: isQuickAction ? "QUICK_ACTION" : "VIEW_DUES",
          response: "Sri Adithya Hostels: No active context found. Use the menu commands below to view stats or send reminders.",
          success: true,
        });
      }

      if (isQuickAction) {
        // Increment metrics
        await prisma.owner_daily_briefings.update({
          where: { id: latestBriefing.id },
          data: {
            quick_action_clicks: { increment: 1 },
            updated_at: new Date(),
          },
        });

        // Resolve priority_type
        const priority = latestBriefing.priority_type;
        if (priority === "COLLECTIONS") {
          const pending = await this.getPendingDues(ownerId);
          const topRows = pending.rows.slice(0, 10);
          const tenantBlocks = topRows.map((row) => `${row.name}\n${money(row.amount)}`);
          const response = topRows.length > 0
            ? [
                "⚠️ Collections Requiring Attention",
                "",
                tenantBlocks.join("\n\n"),
                "",
                "Total Pending",
                money(pending.totalPending),
                "",
                "Reply:",
                "SEND REMINDERS",
              ].join("\n")
            : [
                "⚠️ Collections Requiring Attention",
                "",
                "No pending collections.",
                "",
                "Total Pending",
                "₹0",
              ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response,
            success: true,
          });
        } else if (priority === "ONBOARDING") {
          const invites = await prisma.tenants.findMany({
            where: { owner_id: ownerId, status: "INVITED" },
            include: {
              profiles: { select: { name: true } },
              room_allocations: {
                where: { is_active: true },
                include: { room: { select: { room_no: true } } }
              },
              rule_acceptances: { select: { id: true } },
              agreements: { select: { status: true } }
            },
            orderBy: { created_at: "desc" }
          });

          if (invites.length === 0) {
            return this.respondAndLog({
              ownerId,
              phone: normalizedPhone,
              message,
              command: "QUICK_ACTION",
              response: [
                "👥 Pending Onboarding",
                "",
                "No onboarding pending.",
              ].join("\n"),
              success: true,
            });
          }

          const inviteLines = invites.map((invite) => {
            const name = invite.profiles?.name || invite.guardian_name || "Resident";
            const roomNo = invite.room_allocations?.[0]?.room?.room_no || "N/A";
            let step = "";
            if (roomNo === "N/A") {
              step = "Room Allocation Pending";
            } else if (!invite.document_verified) {
              step = "ID Verification Pending";
            } else {
              const hasSignedAgreement = invite.agreements?.some((a) => a.status === "SIGNED");
              if (!hasSignedAgreement) {
                step = "Agreement Pending";
              } else {
                step = "Pending Activation";
              }
            }
            return `${name}\n${step}`;
          });

          const response = [
            "👥 Pending Onboarding",
            "",
            inviteLines.join("\n\n"),
            "",
            "👉 Next Best Action: Reply INVITE to invite a new tenant.",
          ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response,
            success: true,
          });
        } else if (priority === "OCCUPANCY") {
          const hostels = await this.getActiveHostels(ownerId);
          const lines: string[] = [];
          let totalVacant = 0;
          let totalOccupied = 0;
          let totalCapacity = 0;

          for (const hostel of hostels) {
            try {
              const stats = await dashboardService.getOwnerStatsShell(ownerId, hostel.id);
              const vacant = stats.vacant_beds || 0;
              const occupied = stats.occupied_beds || 0;
              const capacity = stats.total_capacity || 0;
              totalVacant += vacant;
              totalOccupied += occupied;
              totalCapacity += capacity;

              lines.push(hostel.name);
              lines.push(`${vacant} Vacant Bed${vacant === 1 ? "" : "s"}`);
              lines.push("");
            } catch {}
          }

          if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
          }

          const overallOccupancy = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
          const response = [
            "🏠 Occupancy Alert",
            "",
            ...lines,
            "",
            "Occupancy",
            `${overallOccupancy}%`,
            "",
            "👉 Next Best Action: Reply INVITE to assign a room and send an invitation.",
          ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response,
            success: true,
          });
        } else if (priority === "PROFITABILITY") {
          const hostels = await this.getActiveHostels(ownerId);
          let totalRev = 0;
          let totalExp = 0;
          const categoryTotals = new Map<string, number>();

          for (const hostel of hostels) {
            try {
              const stats = await dashboardService.getOwnerStatsShell(ownerId, hostel.id);
              totalRev += stats.revenue || 0;
              totalExp += stats.monthly_expenses || 0;

              const categories = stats.intelligence?.expenses?.categories || [];
              for (const cat of categories) {
                const name = cat.category || "Other";
                const amount = Number(cat.amount || 0);
                categoryTotals.set(name, (categoryTotals.get(name) || 0) + amount);
              }
            } catch {}
          }

          const overallRatio = totalRev > 0 ? Math.round((totalExp / totalRev) * 100) : 0;

          const sortedCategories = Array.from(categoryTotals.entries())
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);

          const categoryLines: string[] = [];
          for (const cat of sortedCategories.slice(0, 3)) {
            categoryLines.push(cat.category);
            categoryLines.push(money(cat.amount));
            categoryLines.push("");
          }
          if (categoryLines.length > 0) {
            categoryLines.pop();
          }

          const response = [
            "💸 Expense Review",
            "",
            "Revenue",
            money(totalRev),
            "",
            "Expenses",
            money(totalExp),
            "",
            "Expense Ratio",
            `${overallRatio}%`,
            ...(categoryLines.length > 0 ? ["", "Top Categories", "", ...categoryLines] : [])
          ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response,
            success: true,
          });
        } else if (priority === "OPERATIONS") {
          const moveOuts = await prisma.move_out_requests.findMany({
            where: {
              owner_id: ownerId,
              status: { notIn: ["COMPLETED", "REJECTED"] }
            },
            include: {
              tenant: {
                include: {
                  profiles: { select: { name: true } },
                  room_allocations: {
                    where: { is_active: true },
                    include: { room: { select: { room_no: true } } }
                  }
                }
              }
            },
            orderBy: { created_at: "desc" }
          });

          if (moveOuts.length === 0) {
            return this.respondAndLog({
              ownerId,
              phone: normalizedPhone,
              message,
              command: "QUICK_ACTION",
              response: [
                "📦 Operations Alert",
                "",
                "No pending move-out requests.",
              ].join("\n"),
              success: true,
            });
          }

          const lines: string[] = [];
          for (const req of moveOuts) {
            const name = req.tenant?.profiles?.name || "Resident";
            const roomNo = req.tenant?.room_allocations?.[0]?.room?.room_no || "N/A";
            const exitDateStr = req.planned_exit_date
              ? formatShortDate(req.planned_exit_date)
              : "N/A";
            lines.push(name);
            lines.push(`Room ${roomNo}`);
            lines.push(`Exit Date: ${exitDateStr}`);
            lines.push("");
          }

          if (lines.length > 0) {
            lines.pop();
          }

          const response = [
            "📦 Operations Alert",
            "",
            "Move-Out Requests",
            "",
            ...lines
          ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response,
            success: true,
          });
        } else {
          return this.respondAndLog({
            ownerId,
            phone: normalizedPhone,
            message,
            command: "QUICK_ACTION",
            response: "Everything is running smoothly. Your hostels are healthy with no urgent actions required.",
            success: true,
          });
        }
      } else {
        // isViewDues
        await prisma.owner_daily_briefings.update({
          where: { id: latestBriefing.id },
          data: {
            view_dues_clicks: { increment: 1 },
            updated_at: new Date(),
          },
        });
        return this.handleDues(ownerId, normalizedPhone, message);
      }
    }

    if (["YES", "NO", "CONFIRM", "CANCEL"].includes(parsed.command)) {
      return this.handleConfirmationResponse(ownerId, normalizedPhone, message, parsed.command);
    }

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

    if (isSendRemindersCommand(parsed.upper)) {
      return this.handleSendRemindersRequest(ownerId, normalizedPhone, message);
    }

    if (parsed.command === "CONNECTED") {
      return this.handleConnectedWhatsAppRequest(ownerId, normalizedPhone, message);
    }

    if (parsed.command === "DISCONNECT") {
      return this.handleDisconnectWhatsAppRequest(ownerId, normalizedPhone, message, verifiedIdentity);
    }

    if (isExpenseReportCommand(parsed)) {
      return this.handleExpenseReport(ownerId, normalizedPhone, message);
    }

    if (parsed.upper === "UNDO EXPENSE") {
      return this.handleUndoExpenseRequest(ownerId, normalizedPhone, message);
    }

    const expenseDraft = parseOwnerExpenseWriteCommand(message);
    if (expenseDraft) {
      return this.handleCreateExpenseRequest(ownerId, normalizedPhone, message, expenseDraft);
    }

    return this.handleEntitySearch(ownerId, normalizedPhone, message);
  }

  private async handleOwnerAssistantPayload(
    ownerId: string,
    phone: string,
    message: string,
    payload: { action: string; id?: string }
  ): Promise<InboundOwnerResult> {
    const id = payload.id || "";
    switch (payload.action) {
      case "TENANT_CARD":
        return this.sendTenantCard(ownerId, phone, message, id);
      case "TENANT_PAYMENTS":
        return this.sendTenantPayments(ownerId, phone, message, id);
      case "TENANT_DUES":
        return this.sendTenantDues(ownerId, phone, message, id);
      case "TENANT_REMINDER":
        return this.handleTenantReminderRequest(ownerId, phone, message, id);
      case "TENANT_MOVE_OUT":
        return this.handleTenantMoveOutRequest(ownerId, phone, message, id);
      case "ROOM_CARD":
        return this.sendRoomCard(ownerId, phone, message, id);
      case "ROOM_TENANTS":
        return this.sendRoomTenants(ownerId, phone, message, id);
      case "ROOM_INVITE":
        return this.handleRoomInvite(ownerId, phone, message, id);
      case "ROOM_OCCUPANCY":
        return this.sendRoomCard(ownerId, phone, message, id);
      case "LEAD_CARD":
        return this.sendLeadCard(ownerId, phone, message, id);
      case "HOSTEL_CARD":
        return this.sendHostelCard(ownerId, phone, message, id);
      case "VIEW_MORE_SEARCH":
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "ENTITY_SEARCH_MORE",
          response: "Please type a few more letters, the full phone number, or the room number to narrow the result.",
          success: true,
        });
      default:
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "UNKNOWN_ACTION",
          response: HELP_TEXT,
          success: false,
        });
    }
  }

  private async handleEntitySearch(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    const query = normalizeSearchText(message);
    if (query.length < 2) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ENTITY_SEARCH",
        response: HELP_TEXT,
        success: true,
      });
    }

    const results = await this.findEntityMatches(ownerId, query);
    if (results.length === 0) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ENTITY_SEARCH",
        response: [
          "No matching tenant, room, lead, or hostel found.",
          "",
          "Try a full name, mobile number, or room number.",
          "",
          "Send HELP to view commands.",
        ].join("\n"),
        success: true,
      });
    }

    if (results.length === 1) {
      return this.openEntityResult(ownerId, phone, message, results[0]);
    }

    await setSelectionState(phone, {
      phone,
      action: "OWNER_ENTITY_SEARCH",
      ownerId,
      query,
      resultIds: results.map((result) => `${result.type}:${result.id}`),
    });

    const body = [
      `Found ${results.length} matches`,
      "",
      "Choose one to open the card.",
    ].join("\n");

    if (results.length <= 3) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ENTITY_SEARCH",
        response: body,
        success: true,
        buttons: results.map((result) => ({
          id: this.entityPayloadId(result),
          title: this.shortButtonTitle(result.label),
        })),
      });
    }

    const rows = results.slice(0, 9).map((result) => ({
      id: this.entityPayloadId(result),
      title: result.label.slice(0, 24),
      description: result.description.slice(0, 72),
    }));
    rows.push({
      id: "VIEW_MORE_SEARCH:MORE",
      title: "View More",
      description: "Type more details to narrow search",
    });

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "ENTITY_SEARCH",
      response: body,
      success: true,
      list: {
        buttonText: "Open result",
        sections: [{
          title: "Matches",
          rows,
        }],
      },
    });
  }

  private async openEntityResult(
    ownerId: string,
    phone: string,
    message: string,
    result: EntitySearchResult
  ): Promise<InboundOwnerResult> {
    if (result.type === "TENANT") return this.sendTenantCard(ownerId, phone, message, result.id);
    if (result.type === "ROOM") return this.sendRoomCard(ownerId, phone, message, result.id);
    if (result.type === "LEAD") return this.sendLeadCard(ownerId, phone, message, result.id);
    return this.sendHostelCard(ownerId, phone, message, result.id);
  }

  private entityPayloadId(result: EntitySearchResult) {
    if (result.type === "TENANT") return `TENANT_CARD:${result.id}`;
    if (result.type === "ROOM") return `ROOM_CARD:${result.id}`;
    if (result.type === "LEAD") return `LEAD_CARD:${result.id}`;
    return `HOSTEL_CARD:${result.id}`;
  }

  private shortButtonTitle(label: string) {
    return String(label || "Open").replace(/\s+/g, " ").slice(0, 20);
  }

  private async findEntityMatches(ownerId: string, query: string): Promise<EntitySearchResult[]> {
    const like = `%${query}%`;
    const digits = query.replace(/\D/g, "");
    const phoneLike = digits.length >= 4 ? `%${digits}%` : null;
    const results: EntitySearchResult[] = [];

    const rooms = await prisma.$queryRaw<Array<{
      id: string;
      room_no: string;
      hostel_name: string;
      capacity: number;
      occupied: number;
    }>>`
      SELECT
        r.id::text,
        r.room_no,
        h.name AS hostel_name,
        r.capacity,
        COUNT(ra.id)::int AS occupied
      FROM rooms r
      JOIN hostels h ON h.id = r.hostel_id
      LEFT JOIN room_allocations ra ON ra.room_id = r.id AND ra.is_active = true AND ra.end_date IS NULL
      WHERE h.owner_id = ${ownerId}::uuid
        AND r.is_active = true
        AND lower(r.room_no) = lower(${query})
      GROUP BY r.id, r.room_no, h.name, r.capacity
      LIMIT 3
    `;

    for (const room of rooms) {
      results.push({
        type: "ROOM",
        id: room.id,
        label: `Room ${room.room_no}`,
        description: `${room.hostel_name} · ${room.occupied}/${room.capacity} occupied`,
        priority: 4,
      });
    }

    const activeTenants = await this.searchTenants(ownerId, like, phoneLike, "ACTIVE", 10);
    results.push(...activeTenants.map((tenant) => ({
      type: "TENANT" as const,
      id: tenant.id,
      label: tenant.name,
      description: `${tenant.status}${tenant.room_no ? ` · Room ${tenant.room_no}` : ""}`,
      priority: phoneLike && tenant.phone_digits?.includes(digits) ? 5 : 10,
    })));

    const invitedTenants = await this.searchTenants(ownerId, like, phoneLike, "INVITED", 10);
    results.push(...invitedTenants.map((tenant) => ({
      type: "TENANT" as const,
      id: tenant.id,
      label: tenant.name,
      description: `Invited${tenant.room_no ? ` · Room ${tenant.room_no}` : ""}`,
      priority: phoneLike && tenant.phone_digits?.includes(digits) ? 15 : 20,
    })));

    const leads = await prisma.$queryRaw<Array<{
      id: string;
      student_name: string;
      student_phone: string | null;
      status: string;
      hostel_name: string;
      converted_tenant_id: string | null;
    }>>`
      SELECT
        l.id::text,
        l.student_name,
        l.student_phone,
        l.status,
        h.name AS hostel_name,
        l.converted_tenant_id::text
      FROM visitor_leads l
      JOIN hostels h ON h.id = l.hostel_id
      WHERE l.owner_id = ${ownerId}::uuid
        AND (
          l.student_name ILIKE ${like}
          OR l.parent_name ILIKE ${like}
          OR (${phoneLike}::text IS NOT NULL AND regexp_replace(COALESCE(l.student_phone, l.parent_phone, ''), '\\D', '', 'g') LIKE ${phoneLike})
        )
      ORDER BY l.last_activity_at DESC
      LIMIT 5
    `;

    for (const lead of leads) {
      results.push({
        type: lead.converted_tenant_id ? "TENANT" : "LEAD",
        id: lead.converted_tenant_id || lead.id,
        label: lead.student_name || "Lead",
        description: `Lead · ${lead.status} · ${lead.hostel_name}`,
        priority: 30,
      });
    }

    if (rooms.length === 0) {
      const roomContains = await prisma.$queryRaw<Array<{
        id: string;
        room_no: string;
        hostel_name: string;
        capacity: number;
        occupied: number;
      }>>`
        SELECT
          r.id::text,
          r.room_no,
          h.name AS hostel_name,
          r.capacity,
          COUNT(ra.id)::int AS occupied
        FROM rooms r
        JOIN hostels h ON h.id = r.hostel_id
        LEFT JOIN room_allocations ra ON ra.room_id = r.id AND ra.is_active = true AND ra.end_date IS NULL
        WHERE h.owner_id = ${ownerId}::uuid
          AND r.is_active = true
          AND r.room_no ILIKE ${like}
        GROUP BY r.id, r.room_no, h.name, r.capacity
        ORDER BY r.room_no ASC
        LIMIT 5
      `;

      for (const room of roomContains) {
        results.push({
          type: "ROOM",
          id: room.id,
          label: `Room ${room.room_no}`,
          description: `${room.hostel_name} · ${room.occupied}/${room.capacity} occupied`,
          priority: 50,
        });
      }
    }

    const hostels = await prisma.hostels.findMany({
      where: {
        owner_id: ownerId,
        is_active: true,
        name: { contains: query, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: 3,
      orderBy: { name: "asc" },
    });
    results.push(...hostels.map((hostel) => ({
      type: "HOSTEL" as const,
      id: hostel.id,
      label: hostel.name,
      description: "Hostel",
      priority: 60,
    })));

    const seen = new Set<string>();
    return results
      .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
      .filter((result) => {
        const key = `${result.type}:${result.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, ENTITY_SEARCH_LIMIT);
  }

  private async searchTenants(
    ownerId: string,
    like: string,
    phoneLike: string | null,
    status: "ACTIVE" | "INVITED",
    limit: number
  ): Promise<Array<{ id: string; name: string; status: string; room_no: string | null; phone_digits: string | null }>> {
    return prisma.$queryRaw<Array<{ id: string; name: string; status: string; room_no: string | null; phone_digits: string | null }>>`
      SELECT
        t.id::text,
        COALESCE(p.name, ti.name, t.guardian_name, 'Tenant') AS name,
        t.status::text AS status,
        r.room_no,
        regexp_replace(COALESCE(p.phone, t.phone_1, ti.phone, ''), '\\D', '', 'g') AS phone_digits
      FROM tenants t
      LEFT JOIN profile p ON p.id = t.profile_id
      LEFT JOIN LATERAL (
        SELECT name, phone
        FROM tenant_invitations
        WHERE tenant_id = t.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ti ON true
      LEFT JOIN room_allocations ra ON ra.tenant_id = t.id AND ra.is_active = true AND ra.end_date IS NULL
      LEFT JOIN rooms r ON r.id = ra.room_id
      WHERE t.owner_id = ${ownerId}::uuid
        AND t.status::text = ${status}
        AND (
          COALESCE(p.name, '') ILIKE ${like}
          OR COALESCE(t.guardian_name, '') ILIKE ${like}
          OR COALESCE(ti.name, '') ILIKE ${like}
          OR COALESCE(t.roll_number, '') ILIKE ${like}
          OR (${phoneLike}::text IS NOT NULL AND regexp_replace(COALESCE(p.phone, t.phone_1, ti.phone, ''), '\\D', '', 'g') LIKE ${phoneLike})
        )
      ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
      LIMIT ${limit}
    `;
  }

  private async sendTenantCard(ownerId: string, phone: string, message: string, tenantId: string): Promise<InboundOwnerResult> {
    try {
      const overview: any = await tenantService.getOwnerTenantOverview(tenantId, ownerId);
      const lastPayment = overview.recent_payments?.[0] || null;
      const body = [
        `👤 ${overview.name || "Tenant"}`,
        "",
        overview.phone ? `📱 ${maskWhatsAppPhone(overview.phone)}` : "",
        `🏠 Room ${overview.room_number || "N/A"}`,
        overview.current_room?.floor != null ? `Floor ${overview.current_room.floor}` : "",
        `⚠️ Due: ${money(overview.total_due || overview.outstanding || 0)}`,
        "",
        "💰 Last Payment:",
        lastPayment ? `${money(lastPayment.amount)} on ${formatShortDate(new Date(lastPayment.date))}` : "No payments found",
        "",
        `Status: ${overview.status || "Unknown"}`,
      ].filter(Boolean).join("\n");

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_CARD",
        response: body,
        success: true,
        buttons: [
          { id: `TENANT_PAYMENTS:${tenantId}`, title: "Payments" },
          { id: `TENANT_DUES:${tenantId}`, title: "Dues" },
          { id: `TENANT_MOVE_OUT:${tenantId}`, title: "Move-Out" },
        ],
      });
    } catch (error: any) {
      logger.warn("entity.tenant_card_failed", { owner_id: ownerId, tenant_id: tenantId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_CARD",
        response: "Tenant not found or no longer belongs to this owner.",
        success: false,
      });
    }
  }

  private async sendTenantPayments(ownerId: string, phone: string, message: string, tenantId: string): Promise<InboundOwnerResult> {
    try {
      const overview: any = await tenantService.getOwnerTenantOverview(tenantId, ownerId);
      const history = await paymentService.getTenantPaymentHistory(tenantId);
      const payments = (history.payments || []).slice(0, 5);
      const lines = payments.length > 0
        ? payments.flatMap((payment: any) => [
            `${money(payment.amount_paid)}`,
            `${formatShortDate(new Date(payment.payment_date))}${payment.payment_method ? ` · ${String(payment.payment_method).toUpperCase()}` : ""}`,
            "",
          ])
        : ["No payments found."];
      if (lines[lines.length - 1] === "") lines.pop();

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_PAYMENTS",
        response: [
          "💰 Payment History",
          "",
          overview.name || "Tenant",
          "",
          ...lines,
        ].join("\n"),
        success: true,
        buttons: [
          { id: `TENANT_DUES:${tenantId}`, title: "Dues" },
          { id: `TENANT_CARD:${tenantId}`, title: "Tenant Card" },
        ],
      });
    } catch (error: any) {
      logger.warn("entity.tenant_payments_failed", { owner_id: ownerId, tenant_id: tenantId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_PAYMENTS",
        response: "Could not load payment history for this tenant.",
        success: false,
      });
    }
  }

  private async sendTenantDues(ownerId: string, phone: string, message: string, tenantId: string): Promise<InboundOwnerResult> {
    try {
      const overview: any = await tenantService.getOwnerTenantOverview(tenantId, ownerId);
      if (!overview.current_room && !overview.room_number && !overview.current_room?.id && !overview.id) {
        throw new Error("TENANT_OVERVIEW_INVALID");
      }
      const hostelId = await this.getTenantHostelId(ownerId, tenantId);
      const dues = await financialService.getTenantDues(tenantId, ownerId, hostelId);
      const lines = dues.items.slice(0, 5).flatMap((item: any) => [
        this.formatDueItemLabel(item),
        money(item.outstanding),
        "",
      ]);
      if (lines[lines.length - 1] === "") lines.pop();

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_DUES",
        response: [
          "⚠️ Outstanding Dues",
          "",
          overview.name || "Tenant",
          "",
          ...(lines.length > 0 ? lines : ["No outstanding dues."]),
          "",
          "Total",
          money(dues.total_due),
        ].join("\n"),
        success: true,
        buttons: [
          { id: `TENANT_REMINDER:${tenantId}`, title: "Reminder" },
          { id: `TENANT_PAYMENTS:${tenantId}`, title: "Payments" },
          { id: `TENANT_CARD:${tenantId}`, title: "Tenant Card" },
        ],
      });
    } catch (error: any) {
      logger.warn("entity.tenant_dues_failed", { owner_id: ownerId, tenant_id: tenantId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_DUES",
        response: "Could not load dues for this tenant.",
        success: false,
      });
    }
  }

  private formatDueItemLabel(item: any) {
    const type = titleCase(String(item.type || "Due").replace(/_/g, " "));
    const month = item.rent_month ? formatShortDate(new Date(item.rent_month)) : "";
    return [month, type].filter(Boolean).join(" ");
  }

  private async handleTenantReminderRequest(ownerId: string, phone: string, message: string, tenantId: string): Promise<InboundOwnerResult> {
    const overview: any = await tenantService.getOwnerTenantOverview(tenantId, ownerId);
    const totalPending = Number(overview.total_due || overview.outstanding || 0);
    const payload: SendRemindersPayload = {
      action: SEND_REMINDERS_ACTION,
      tenantIds: [tenantId],
      tenantCount: 1,
      totalPending,
      createdAt: new Date().toISOString(),
    };
    await this.createPendingConfirmation(ownerId, phone, SEND_REMINDERS_ACTION, payload);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "TENANT_REMINDER",
      response: [
        "Send reminder?",
        "",
        overview.name || "Tenant",
        totalPending > 0 ? `Due: ${money(totalPending)}` : "No outstanding dues found.",
        "",
        "CONFIRM",
        "CANCEL",
      ].join("\n"),
      success: true,
      buttons: [
        { id: "CONFIRM", title: "Confirm" },
        { id: "CANCEL", title: "Cancel" },
      ],
    });
  }

  private async handleTenantMoveOutRequest(ownerId: string, phone: string, message: string, tenantId: string): Promise<InboundOwnerResult> {
    const overview: any = await tenantService.getOwnerTenantOverview(tenantId, ownerId);
    if (String(overview.status || "").toUpperCase() !== "ACTIVE") {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "TENANT_MOVE_OUT",
        response: `Move-out can only be started for ACTIVE tenants. Current status: ${overview.status || "Unknown"}.`,
        success: false,
      });
    }

    await setSelectionState(phone, {
      phone,
      action: "OWNER_MOVE_OUT_DATE",
      ownerId,
      tenantId,
    });

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "TENANT_MOVE_OUT",
      response: [
        "🚪 Start move-out",
        "",
        overview.name || "Tenant",
        `Room ${overview.room_number || "N/A"}`,
        "",
        "Send planned exit date as YYYY-MM-DD.",
        "",
        "Reply CANCEL to abort.",
      ].join("\n"),
      success: true,
    });
  }

  private async handleMoveOutDateResponse(
    ownerId: string,
    phone: string,
    message: string,
    state: OwnerMoveOutDateState
  ): Promise<InboundOwnerResult> {
    if (message.trim().toUpperCase() === "CANCEL") {
      await deleteSelectionState(phone);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "MOVE_OUT_DATE_CANCEL",
        response: "Move-out cancelled. No changes were made.",
        success: true,
      });
    }

    const plannedExitDate = parseIsoDateOnly(message);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!plannedExitDate || new Date(`${plannedExitDate}T00:00:00`).getTime() < today.getTime()) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "MOVE_OUT_DATE_INVALID",
        response: "Please send a valid future planned exit date as YYYY-MM-DD, or reply CANCEL.",
        success: false,
      });
    }

    const overview: any = await tenantService.getOwnerTenantOverview(state.tenantId, ownerId);
    const hostelId = await this.getTenantHostelId(ownerId, state.tenantId);
    const payload: StartMoveOutPayload = {
      action: START_MOVE_OUT_ACTION,
      tenant_id: state.tenantId,
      hostel_id: hostelId,
      planned_exit_date: plannedExitDate,
      phone_number: phone,
      createdAt: new Date().toISOString(),
    };

    await deleteSelectionState(phone);
    await this.createPendingConfirmation(ownerId, phone, START_MOVE_OUT_ACTION, payload);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: START_MOVE_OUT_ACTION,
      response: [
        "Start move-out process?",
        "",
        overview.name || "Tenant",
        `Room ${overview.room_number || "N/A"}`,
        `Planned Exit: ${formatShortDate(new Date(plannedExitDate))}`,
        "",
        "CONFIRM",
        "CANCEL",
      ].join("\n"),
      success: true,
      buttons: [
        { id: "CONFIRM", title: "Confirm" },
        { id: "CANCEL", title: "Cancel" },
      ],
    });
  }

  private async sendRoomCard(ownerId: string, phone: string, message: string, roomId: string): Promise<InboundOwnerResult> {
    const room = await this.getOwnerRoom(ownerId, roomId);
    if (!room) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_CARD",
        response: "Room not found or no longer belongs to this owner.",
        success: false,
      });
    }

    const body = [
      `🏠 Room ${room.room_no}`,
      "",
      `🏢 ${room.hostel_name}`,
      `Capacity: ${room.capacity}`,
      `Occupied: ${room.occupied}`,
      `Vacant: ${Math.max(0, room.capacity - room.occupied)}`,
    ].join("\n");

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "ROOM_CARD",
      response: body,
      success: true,
      buttons: [
        { id: `ROOM_TENANTS:${roomId}`, title: "Tenants" },
        { id: `ROOM_INVITE:${roomId}`, title: "Invite" },
        { id: `ROOM_OCCUPANCY:${roomId}`, title: "Occupancy" },
      ],
    });
  }

  private async sendRoomTenants(ownerId: string, phone: string, message: string, roomId: string): Promise<InboundOwnerResult> {
    const room = await this.getOwnerRoom(ownerId, roomId);
    if (!room) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_TENANTS",
        response: "Room not found or no longer belongs to this owner.",
        success: false,
      });
    }

    const tenants = await prisma.$queryRaw<Array<{ id: string; name: string; status: string }>>`
      SELECT t.id::text, COALESCE(p.name, t.guardian_name, 'Tenant') AS name, t.status::text AS status
      FROM room_allocations ra
      JOIN tenants t ON t.id = ra.tenant_id
      LEFT JOIN profile p ON p.id = t.profile_id
      WHERE ra.room_id = ${roomId}::uuid
        AND ra.is_active = true
        AND ra.end_date IS NULL
        AND t.owner_id = ${ownerId}::uuid
      ORDER BY p.name ASC NULLS LAST, t.created_at DESC
      LIMIT 10
    `;

    if (tenants.length === 0) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_TENANTS",
        response: `Room ${room.room_no} has no active tenants.`,
        success: true,
        buttons: [
          { id: `ROOM_INVITE:${roomId}`, title: "Invite" },
          { id: `ROOM_CARD:${roomId}`, title: "Room Card" },
        ],
      });
    }

    if (tenants.length <= 3) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_TENANTS",
        response: [
          `Room ${room.room_no} Tenants`,
          "",
          "Choose a tenant.",
        ].join("\n"),
        success: true,
        buttons: tenants.map((tenant) => ({
          id: `TENANT_CARD:${tenant.id}`,
          title: this.shortButtonTitle(tenant.name),
        })),
      });
    }

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "ROOM_TENANTS",
      response: `Room ${room.room_no} Tenants`,
      success: true,
      list: {
        buttonText: "Open tenant",
        sections: [{
          title: "Tenants",
          rows: tenants.map((tenant) => ({
            id: `TENANT_CARD:${tenant.id}`,
            title: tenant.name.slice(0, 24),
            description: tenant.status,
          })),
        }],
      },
    });
  }

  private async handleRoomInvite(ownerId: string, phone: string, message: string, roomId: string): Promise<InboundOwnerResult> {
    const room = await this.getOwnerRoom(ownerId, roomId);
    if (!room) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_INVITE",
        response: "Room not found or no longer belongs to this owner.",
        success: false,
      });
    }
    if (room.capacity - room.occupied <= 0) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "ROOM_INVITE",
        response: `Room ${room.room_no} has no vacant beds.`,
        success: false,
      });
    }

    await setSelectionState(phone, {
      phone,
      action: "INVITE_TENANT",
      step: "AWAITING_NAME",
      data: {
        hostelId: room.hostel_id,
        roomId: room.id,
        roomNo: room.room_no,
      },
    });

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "ROOM_INVITE",
      response: [
        `Invite tenant to Room ${room.room_no}`,
        "",
        "What is the tenant's full name?",
        "",
        "Reply CANCEL to abort.",
      ].join("\n"),
      success: true,
    });
  }

  private async sendLeadCard(ownerId: string, phone: string, message: string, leadId: string): Promise<InboundOwnerResult> {
    const leads = await prisma.$queryRaw<Array<{
      id: string;
      student_name: string;
      student_phone: string | null;
      status: string;
      hostel_name: string;
      converted_tenant_id: string | null;
    }>>`
      SELECT
        l.id::text,
        l.student_name,
        l.student_phone,
        l.status,
        h.name AS hostel_name,
        l.converted_tenant_id::text
      FROM visitor_leads l
      JOIN hostels h ON h.id = l.hostel_id
      WHERE l.id = ${leadId}::uuid
        AND l.owner_id = ${ownerId}::uuid
      LIMIT 1
    `;
    const lead = leads[0];
    if (!lead) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "LEAD_CARD",
        response: "Lead not found or no longer belongs to this owner.",
        success: false,
      });
    }
    if (lead.converted_tenant_id) {
      return this.sendTenantCard(ownerId, phone, message, lead.converted_tenant_id);
    }

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "LEAD_CARD",
      response: [
        `👤 ${lead.student_name}`,
        "",
        lead.student_phone ? `📱 ${maskWhatsAppPhone(lead.student_phone)}` : "",
        `🏢 ${lead.hostel_name}`,
        `Status: Lead · ${lead.status}`,
        "",
        "Admissions actions are not enabled in WhatsApp yet.",
      ].filter(Boolean).join("\n"),
      success: true,
    });
  }

  private async sendHostelCard(ownerId: string, phone: string, message: string, hostelId: string): Promise<InboundOwnerResult> {
    const hostel = await prisma.hostels.findUnique({
      where: { id: hostelId },
      select: { id: true, name: true, owner_id: true, is_active: true },
    });
    if (!hostel || hostel.owner_id !== ownerId || !hostel.is_active) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "HOSTEL_CARD",
        response: "Hostel not found or no longer belongs to this owner.",
        success: false,
      });
    }
    const stats = await dashboardService.getOwnerStatsShell(ownerId, hostel.id);
    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "HOSTEL_CARD",
      response: [
        `🏢 ${hostel.name}`,
        "",
        `Occupancy: ${stats.occupied_beds || 0}/${stats.total_capacity || 0}`,
        `Vacant: ${stats.vacant_beds || 0}`,
        `Pending Dues: ${money(stats.pending_dues || 0)}`,
      ].join("\n"),
      success: true,
    });
  }

  private async getTenantHostelId(ownerId: string, tenantId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { hostel_id: true, owner_id: true },
    });
    if (!tenant?.hostel_id || tenant.owner_id !== ownerId) throw new Error("TENANT_NOT_FOUND");
    return tenant.hostel_id;
  }

  private async getOwnerRoom(ownerId: string, roomId: string): Promise<{
    id: string;
    room_no: string;
    hostel_id: string;
    hostel_name: string;
    capacity: number;
    occupied: number;
  } | null> {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      room_no: string;
      hostel_id: string;
      hostel_name: string;
      capacity: number;
      occupied: number;
    }>>`
      SELECT
        r.id::text,
        r.room_no,
        r.hostel_id::text,
        h.name AS hostel_name,
        r.capacity,
        COUNT(ra.id)::int AS occupied
      FROM rooms r
      JOIN hostels h ON h.id = r.hostel_id
      LEFT JOIN room_allocations ra ON ra.room_id = r.id AND ra.is_active = true AND ra.end_date IS NULL
      WHERE r.id = ${roomId}::uuid
        AND h.owner_id = ${ownerId}::uuid
        AND r.is_active = true
      GROUP BY r.id, r.room_no, r.hostel_id, h.name, r.capacity
      LIMIT 1
    `;
    return rows[0] || null;
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

    const cleanDigits = phone.replace(/[^0-9]/g, "");
    const last10 = cleanDigits.slice(-10);
    if (last10.length === 10) {
      const tenantProfile = await prisma.profile.findFirst({
        where: {
          phone: { contains: last10 },
          role: "TENANT",
        },
      });

      if (tenantProfile) {
        return this.respondAndLog({
          ownerId: identity.owner_id,
          phone,
          message,
          command,
          response: "Access denied: Tenants cannot connect to the Owner WhatsApp Assistant.",
          success: false,
        });
      }

      const tenantRecord = await prisma.tenants.findFirst({
        where: {
          OR: [
            { phone_1: { contains: last10 } },
            { phone_2: { contains: last10 } },
            { phone_3: { contains: last10 } },
            { guardian_phone: { contains: last10 } },
          ],
        },
      });

      if (tenantRecord) {
        return this.respondAndLog({
          ownerId: identity.owner_id,
          phone,
          message,
          command,
          response: "Access denied: Tenants and guardians cannot connect to the Owner WhatsApp Assistant.",
          success: false,
        });
      }
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

    const result = await this.respondAndLog({
      ownerId: identity.owner_id,
      phone,
      message,
      command,
      response: LINK_SUCCESS_TEXT,
      success: true,
    });

    await this.notifyOwnerConnections(identity.owner_id, this.buildConnectionChangedNotice({
      event: "connected",
      phone,
      connectedCount: await this.countConnections(identity.owner_id),
    }), [phone]);

    return result;
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
      const singleHostel = hostels.length === 1 ? hostels.find(() => true) : null;
      const hostelLabel = singleHostel
        ? singleHostel.name
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
      const pending = await this.getPendingDues(ownerId);
      if (pending.hostels.length === 0) {
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "DUES",
          response: "No active hostel found for this owner account.",
          success: false,
        });
      }

      const topRows = pending.rows.slice(0, 10);

      const response = topRows.length > 0
        ? [
            "⚠️ Top Pending Tenants",
            "",
            ...topRows.map((row, index) =>
              `${index + 1}. ${row.name} - ${money(row.amount)}${row.room && row.room !== "N/A" ? ` (Room ${row.room})` : ""}`
            ),
            "",
            `Total Pending: ${money(pending.totalPending)}`,
            "",
            "Reply:",
            "SEND REMINDERS",
          ].join("\n")
        : [
            "⚠️ Top Pending Tenants",
            "",
            "No pending dues found.",
            "",
            "Total Pending: ₹0",
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

  private async handleSendRemindersRequest(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    try {
      const pending = await this.getPendingDues(ownerId);
      if (pending.hostels.length === 0) {
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: SEND_REMINDERS_ACTION,
          response: "No active hostel found for this owner account.",
          success: false,
        });
      }

      const selectedRows = pending.rows.slice(0, 10);
      if (selectedRows.length === 0) {
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: SEND_REMINDERS_ACTION,
          response: "No pending dues found. No reminders were queued.",
          success: false,
        });
      }

      const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
      const payload: SendRemindersPayload = {
        action: SEND_REMINDERS_ACTION,
        tenantIds: selectedRows.map((row) => row.tenantId),
        tenantCount: selectedRows.length,
        totalPending: selectedTotal,
        createdAt: new Date().toISOString(),
      };

      await this.createPendingConfirmation(ownerId, phone, SEND_REMINDERS_ACTION, payload);

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: SEND_REMINDERS_ACTION,
        response: [
          `Found ${selectedRows.length} tenants with pending dues.`,
          "",
          "Send reminders now?",
          "",
          "CONFIRM",
          "CANCEL",
        ].join("\n"),
        success: true,
      });
    } catch (error: any) {
      logger.error("send_reminders.request_failed", { owner_id: ownerId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: SEND_REMINDERS_ACTION,
        response: "Could not prepare reminders right now. Please try again later.",
        success: false,
      });
    }
  }

  private async handleCreateExpenseRequest(
    ownerId: string,
    phone: string,
    message: string,
    draft: CreateExpensePayload
  ): Promise<InboundOwnerResult> {
    const withinLimit = await this.checkExpenseDraftRateLimit(ownerId, phone);
    if (!withinLimit) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: CREATE_EXPENSE_ACTION,
        response: "Too many expense attempts. Please wait a few minutes and try again.",
        success: false,
      });
    }

    const payload: CreateExpensePayload = {
      ...draft,
      phone_number: phone,
      createdAt: new Date().toISOString(),
    };

    await this.createPendingConfirmation(ownerId, phone, CREATE_EXPENSE_ACTION, payload);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: CREATE_EXPENSE_ACTION,
      response: [
        payload.category,
        money(payload.amount),
        payload.vendor_name ? `Vendor: ${payload.vendor_name}` : "",
        `Payment: ${payload.payment_method.toUpperCase()}`,
        "Date: Today",
        "",
        "Confirm?",
        "",
        "CONFIRM",
        "CANCEL",
      ].filter(Boolean).join("\n"),
      success: true,
    });
  }

  private async checkExpenseDraftRateLimit(ownerId: string, phone: string) {
    const since = new Date(Date.now() - EXPENSE_DRAFT_RATE_LIMIT_WINDOW_MS);
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM owner_assistant_confirmations
      WHERE owner_id = ${ownerId}::uuid
        AND phone_number = ${phone}
        AND action_type = ${CREATE_EXPENSE_ACTION}
        AND created_at >= ${since}
    `;
    return Number(rows[0]?.count || 0) < EXPENSE_DRAFT_RATE_LIMIT_MAX;
  }

  private async handleExpenseReport(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    try {
      const parsed = parseCommand(message);
      const words = parsed.normalized.toLowerCase().split(" ");

      let range: string | undefined = "month";
      let categories: string[] | undefined;
      let limit = EXPENSE_REPORT_LIMIT;
      let title = "Expenses This Month";

      if (parsed.upper === "LAST 5 EXPENSES") {
        range = undefined;
        limit = 5;
        title = "Last 5 Expenses";
      } else if (parsed.upper === "TOP CATEGORIES") {
        return await this.handleTopExpenseCategories(ownerId, phone, message);
      } else if (words[0] === "expenses") {
        const scope = words[1] || "month";
        if (scope === "today") {
          range = "today";
          title = "Expenses Today";
        } else if (scope === "week" || scope === "this-week") {
          range = "week";
          title = "Expenses This Week";
        } else if (scope === "month" || scope === "this-month") {
          range = "month";
          title = "Expenses This Month";
        } else if (scope === "category" && words[2]) {
          range = "month";
          const key = normalizeExpenseTemplateKey(words.slice(2).join(" "));
          const category = categoryForExpenseToken(key) || titleCase(key);
          categories = [category];
          title = `${category} Expenses`;
        }
      }

      const report = await expenseService.getAllExpenses(ownerId, {
        range,
        hostelId: undefined,
        categories,
        sort: "recent",
        limit,
        offset: 0,
      });

      const rows = (report.expenses || []).slice(0, limit);
      const total = rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const lines = rows.map((row: any, index: number) => {
        const date = row.date ? formatShortDate(new Date(row.date)) : "";
        return `${index + 1}. ${row.title || row.category} - ${money(row.amount)}${date ? ` (${date})` : ""}`;
      });

      const response = rows.length > 0
        ? [
            title,
            "",
            ...lines,
            "",
            `Shown Total: ${money(total)}`,
            report.total > rows.length ? `Showing ${rows.length} of ${report.total}` : "",
          ].filter(Boolean).join("\n")
        : [
            title,
            "",
            "No expenses found.",
            "",
            "Total: ₹0",
          ].join("\n");

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "EXPENSE_REPORT",
        response,
        success: true,
      });
    } catch (error: any) {
      logger.error("expense.report_failed", { owner_id: ownerId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "EXPENSE_REPORT",
        response: "Could not fetch expenses right now. Please try again later.",
        success: false,
      });
    }
  }

  private async handleTopExpenseCategories(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    const report = await expenseService.getAllExpenses(ownerId, {
      range: "month",
      hostelId: undefined,
      sort: "recent",
      limit: 1,
      offset: 0,
    });

    const categories = (report.category_breakdown || []).slice(0, 5);
    const response = categories.length > 0
      ? [
          "Top Categories This Month",
          "",
          ...categories.map((row: any, index: number) =>
            `${index + 1}. ${row.category} - ${money(row.amount)} (${Math.round(Number(row.percentage || 0))}%)`
          ),
          "",
          `Total: ${money(report.kpis?.this_month_expenses || 0)}`,
        ].join("\n")
      : [
          "Top Categories This Month",
          "",
          "No expenses found.",
          "",
          "Total: ₹0",
        ].join("\n");

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "TOP_EXPENSE_CATEGORIES",
      response,
      success: true,
    });
  }

  private async handleUndoExpenseRequest(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    const since = new Date(Date.now() - EXPENSE_UNDO_WINDOW_MS);
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      title: string;
      amount: number;
      category: string;
      date: Date;
    }>>`
      SELECT id::text, title, amount::float AS amount, category, date
      FROM expenses
      WHERE owner_id = ${ownerId}::uuid
        AND created_at >= ${since}
        AND metadata->>'source' = 'OWNER_WHATSAPP_ASSISTANT'
        AND metadata->>'phone_number' = ${phone}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const expense = rows[0];

    if (!expense) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: UNDO_EXPENSE_ACTION,
        response: "No recent WhatsApp-created expense found to undo.",
        success: false,
      });
    }

    const payload: UndoExpensePayload = {
      action: UNDO_EXPENSE_ACTION,
      expense_id: expense.id,
      title: expense.title,
      amount: Number(expense.amount || 0),
      category: expense.category,
      date: expense.date ? expense.date.toISOString().slice(0, 10) : "",
      phone_number: phone,
      createdAt: new Date().toISOString(),
    };

    await this.createPendingConfirmation(ownerId, phone, UNDO_EXPENSE_ACTION, payload);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: UNDO_EXPENSE_ACTION,
      response: [
        "Last Expense",
        "",
        payload.title,
        money(payload.amount),
        payload.category,
        "",
        "Delete?",
        "",
        "CONFIRM",
        "CANCEL",
      ].join("\n"),
      success: true,
    });
  }

  private async handleConnectedWhatsAppRequest(ownerId: string, phone: string, message: string): Promise<InboundOwnerResult> {
    const connections = await this.listConnections(ownerId);
    const lines = connections.map((connection, index) => [
      `${index + 1}. ${maskWhatsAppPhone(connection.phone_number)}`,
      `Connected: ${formatConnectionDate(connection.verified_at || connection.created_at)}`,
    ].join("\n"));

    const response = connections.length > 0
      ? [
          "Connected Owner Numbers",
          "",
          lines.join("\n\n"),
          "",
          `Total: ${connections.length}`,
        ].join("\n")
      : [
          "Connected Owner Numbers",
          "",
          "No WhatsApp numbers are connected.",
          "",
          "Generate a link code in Settings → Automation.",
        ].join("\n");

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "CONNECTED",
      response,
      success: true,
    });
  }

  private async handleDisconnectWhatsAppRequest(
    ownerId: string,
    phone: string,
    message: string,
    identity: OwnerIdentity
  ): Promise<InboundOwnerResult> {
    const payload: DisconnectWhatsAppPayload = {
      action: DISCONNECT_WHATSAPP_ACTION,
      identity_id: identity.id,
      phone_number: phone,
      createdAt: new Date().toISOString(),
    };

    await this.createPendingConfirmation(ownerId, phone, DISCONNECT_WHATSAPP_ACTION, payload);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: DISCONNECT_WHATSAPP_ACTION,
      response: [
        "⚠️ Disconnect WhatsApp Assistant?",
        "",
        "This will remove ONLY this phone number:",
        "",
        maskWhatsAppPhone(phone),
        "",
        "You will stop receiving:",
        "",
        "• Daily Briefings",
        "• Dues Alerts",
        "• Expense Commands",
        "• Assistant Responses",
        "",
        "Reply CONFIRM to disconnect.",
        "",
        "Reply CANCEL to keep it connected.",
      ].join("\n"),
      success: true,
    });
  }

  private async handleConfirmationResponse(
    ownerId: string,
    phone: string,
    message: string,
    command: string
  ): Promise<InboundOwnerResult> {
    if (command === "NO" || command === "CANCEL") {
      const cancelled = await this.cancelLatestPendingConfirmation(ownerId, phone);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: cancelled
          ? "Cancelled. No changes were made."
          : "No pending action found.",
        success: Boolean(cancelled),
      });
    }

    const confirmation = await this.confirmLatestPendingAction(ownerId, phone);
    if (!confirmation) {
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "No pending action found, or it expired.",
        success: false,
      });
    }

    if (confirmation.action_type === CREATE_EXPENSE_ACTION) {
      return this.confirmCreateExpense(ownerId, phone, message, command, confirmation);
    }

    if (confirmation.action_type === UNDO_EXPENSE_ACTION) {
      return this.confirmUndoExpense(ownerId, phone, message, command, confirmation);
    }

    if (confirmation.action_type === DISCONNECT_WHATSAPP_ACTION) {
      return this.confirmDisconnectWhatsApp(ownerId, phone, message, command, confirmation);
    }

    if (confirmation.action_type === START_MOVE_OUT_ACTION) {
      return this.confirmStartMoveOut(ownerId, phone, message, command, confirmation);
    }

    const payload = normalizeSendRemindersPayload(confirmation.payload_json);
    if (!payload) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not read the pending reminder action. Send SEND REMINDERS again.",
        success: false,
      });
    }

    let notified = 0;
    let failed = 0;
    for (const tenantId of payload.tenantIds) {
      try {
        const result = await reminderService.sendManualReminder(tenantId, ownerId);
        if (result.sent > 0) notified += 1;
        else failed += 1;
      } catch (error: any) {
        failed += 1;
        logger.warn("send_reminders.tenant_failed", {
          owner_id: ownerId,
          tenant_id: tenantId,
          error: error?.message || String(error),
        });
      }
    }

    await this.updateConfirmationStatus(confirmation.id, notified > 0 ? "COMPLETED" : "FAILED");

    const response = notified > 0
      ? [
          "✅ Reminders Sent",
          "",
          `${notified} tenants notified.`,
          failed > 0 ? `${failed} tenants could not be notified.` : "",
          "",
          "Total pending amount:",
          money(payload.totalPending),
          "",
          "Done.",
        ].filter(Boolean).join("\n")
      : [
          "Could not send reminders right now.",
          "",
          "No tenants were notified.",
          "",
          "Try SEND REMINDERS again later.",
        ].join("\n");

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command,
      response,
      success: notified > 0,
    });
  }

  private async confirmCreateExpense(
    ownerId: string,
    phone: string,
    message: string,
    command: string,
    confirmation: { id: string; payload_json: any }
  ): Promise<InboundOwnerResult> {
    const payload = normalizeCreateExpensePayload(confirmation.payload_json);
    if (!payload || payload.phone_number !== phone) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not read the pending expense. Send the expense again.",
        success: false,
      });
    }

    try {
      const expense = await expenseService.createExpense({
        owner_id: ownerId,
        title: payload.title,
        amount: payload.amount,
        date: payload.date,
        category: payload.category,
        status: "paid",
        hostel_id: null,
        vendor_name: payload.vendor_name,
        payment_method: payload.payment_method,
        created_by: ownerId,
        expense_type: "BUSINESS",
        tags: ["whatsapp"],
        metadata: {
          source: "OWNER_WHATSAPP_ASSISTANT",
          confirmed_via: "WHATSAPP",
          raw_command: payload.raw_command,
          template_key: payload.template_key || null,
          phone_number: phone,
          confirmation_id: confirmation.id,
        },
      });

      await this.updateConfirmationStatus(confirmation.id, "COMPLETED");

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: [
          "Expense Created",
          "",
          expense.title,
          money(Number(expense.amount || payload.amount)),
          expense.category,
          "",
          "Reply UNDO EXPENSE within 30 minutes if this was a mistake.",
        ].join("\n"),
        success: true,
      });
    } catch (error: any) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      logger.error("expense.create_failed", { owner_id: ownerId, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not create the expense. Please try again.",
        success: false,
      });
    }
  }

  private async confirmUndoExpense(
    ownerId: string,
    phone: string,
    message: string,
    command: string,
    confirmation: { id: string; payload_json: any }
  ): Promise<InboundOwnerResult> {
    const payload = normalizeUndoExpensePayload(confirmation.payload_json);
    if (!payload || payload.phone_number !== phone) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not read the pending undo action. Send UNDO EXPENSE again.",
        success: false,
      });
    }

    try {
      await expenseService.deleteExpense(payload.expense_id, ownerId);
      await this.updateConfirmationStatus(confirmation.id, "COMPLETED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: [
          "Expense Deleted",
          "",
          payload.title,
          money(payload.amount),
          "",
          "Done.",
        ].join("\n"),
        success: true,
      });
    } catch (error: any) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      logger.error("expense.undo_failed", { owner_id: ownerId, expense_id: payload.expense_id, error: error?.message || String(error) });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not delete the expense. It may already have been changed in HMS.",
        success: false,
      });
    }
  }

  private async confirmDisconnectWhatsApp(
    ownerId: string,
    phone: string,
    message: string,
    command: string,
    confirmation: { id: string; payload_json: any }
  ): Promise<InboundOwnerResult> {
    const payload = normalizeDisconnectWhatsAppPayload(confirmation.payload_json);
    if (!payload || payload.phone_number !== phone) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not read the pending disconnect action. Send DISCONNECT again.",
        success: false,
      });
    }

    const rows = await prisma.$queryRaw<Array<{ id: string; phone_number: string }>>`
      DELETE FROM owner_whatsapp_identities
      WHERE id = ${payload.identity_id}::uuid
        AND owner_id = ${ownerId}::uuid
        AND phone_number = ${phone}
        AND is_verified = true
      RETURNING id::text, phone_number
    `;
    const disconnected = rows[0];

    if (!disconnected) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "This WhatsApp number is already disconnected.",
        success: false,
      });
    }

    await this.updateConfirmationStatus(confirmation.id, "COMPLETED");
    await this.notifyOwnerConnections(ownerId, this.buildConnectionChangedNotice({
      event: "disconnected",
      phone: disconnected.phone_number,
      connectedCount: await this.countConnections(ownerId),
    }), [disconnected.phone_number]);

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command,
      response: [
        "Disconnected",
        "",
        "This WhatsApp number has been removed from the Owner Assistant.",
      ].join("\n"),
      success: true,
    });
  }

  private async confirmStartMoveOut(
    ownerId: string,
    phone: string,
    message: string,
    command: string,
    confirmation: { id: string; payload_json: any }
  ): Promise<InboundOwnerResult> {
    const payload = normalizeStartMoveOutPayload(confirmation.payload_json);
    if (!payload || payload.phone_number !== phone) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: "Could not read the pending move-out action. Search the tenant and start again.",
        success: false,
      });
    }

    try {
      const overview: any = await tenantService.getOwnerTenantOverview(payload.tenant_id, ownerId);
      const result = await moveOutService.createRequest({
        tenantId: payload.tenant_id,
        hostelId: payload.hostel_id,
        ownerId,
        initiatedBy: ownerId,
        initiatedByRole: "OWNER",
        actor: { id: ownerId, role: "OWNER", ownerId },
        reason: MoveOutReason.OTHER,
        reasonText: "Started from WhatsApp Owner Assistant",
        plannedExitDate: payload.planned_exit_date,
      });

      await this.updateConfirmationStatus(confirmation.id, "COMPLETED");
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: [
          "Move-out Started",
          "",
          overview.name || "Tenant",
          `Planned Exit: ${formatShortDate(new Date(payload.planned_exit_date))}`,
          result.notice_period_violation
            ? `Notice period warning: ${result.notice_period_days} days required.`
            : "",
          "",
          "The move-out workflow has been created in HMS.",
        ].filter(Boolean).join("\n"),
        success: true,
      });
    } catch (error: any) {
      await this.updateConfirmationStatus(confirmation.id, "FAILED");
      logger.warn("move_out.whatsapp_start_failed", {
        owner_id: ownerId,
        tenant_id: payload?.tenant_id,
        error: error?.message || String(error),
      });
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command,
        response: String(error?.message || "").startsWith("VALIDATION:")
          ? String(error.message).replace(/^VALIDATION:\s*/, "")
          : "Could not start move-out for this tenant.",
        success: false,
      });
    }
  }

  private async getPendingDues(ownerId: string): Promise<PendingDuesResult> {
    const hostels = await this.getActiveHostels(ownerId);
    if (hostels.length === 0) {
      return { hostels, rows: [], totalPending: 0 };
    }

    const duesByHostel = await Promise.all(
      hostels.map((hostel) => paymentService.getDuesReport(ownerId, hostel.id))
    );
    const dues = duesByHostel.flat();
    const pendingByTenant = new Map<string, PendingTenantDues>();

    for (const due of dues) {
      const outstanding = Number(due.outstanding || 0);
      if (outstanding <= 0) continue;
      const dueDate = due.due_date ? new Date(due.due_date) : null;
      if (dueDate && dueDate.getTime() > Date.now()) continue;
      const tenantId = String(due.tenant_id || "");
      if (!tenantId) continue;
      const current = pendingByTenant.get(tenantId) || {
        tenantId,
        name: due.tenant_name || "Tenant",
        room: due.room_no || "N/A",
        amount: 0,
      };
      current.amount += outstanding;
      pendingByTenant.set(tenantId, current);
    }

    const rows = Array.from(pendingByTenant.values()).sort((a, b) => b.amount - a.amount);
    const totalPending = rows.reduce((sum, row) => sum + row.amount, 0);
    return { hostels, rows, totalPending };
  }

  private async createPendingConfirmation(
    ownerId: string,
    phone: string,
    actionType: string,
    payload: SendRemindersPayload | CreateExpensePayload | UndoExpensePayload | DisconnectWhatsAppPayload | StartMoveOutPayload
  ) {
    const expiresAt = new Date(Date.now() + CONFIRMATION_WINDOW_MS);
    await this.expirePendingConfirmations(ownerId, phone);

    await prisma.$executeRaw`
      UPDATE owner_assistant_confirmations
      SET status = 'CANCELLED',
          updated_at = now()
      WHERE owner_id = ${ownerId}::uuid
        AND phone_number = ${phone}
        AND status = 'PENDING'
        AND expires_at > now()
    `;

    await prisma.$executeRaw`
      INSERT INTO owner_assistant_confirmations (
        owner_id,
        phone_number,
        action_type,
        payload_json,
        status,
        expires_at,
        updated_at
      )
      VALUES (
        ${ownerId}::uuid,
        ${phone},
        ${actionType},
        CAST(${JSON.stringify(payload)} AS JSONB),
        'PENDING',
        ${expiresAt},
        now()
      )
    `;
  }

  private async confirmLatestPendingAction(ownerId: string, phone: string): Promise<{
    id: string;
    action_type: string;
    payload_json: any;
  } | null> {
    await this.expirePendingConfirmations(ownerId, phone);
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      action_type: string;
      payload_json: any;
    }>>`
      UPDATE owner_assistant_confirmations
      SET status = 'CONFIRMED',
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM owner_assistant_confirmations
        WHERE owner_id = ${ownerId}::uuid
          AND phone_number = ${phone}
          AND status = 'PENDING'
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id::text, action_type, payload_json
    `;
    return rows[0] || null;
  }

  private async cancelLatestPendingConfirmation(ownerId: string, phone: string) {
    await this.expirePendingConfirmations(ownerId, phone);
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE owner_assistant_confirmations
      SET status = 'CANCELLED',
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM owner_assistant_confirmations
        WHERE owner_id = ${ownerId}::uuid
          AND phone_number = ${phone}
          AND status = 'PENDING'
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id::text
    `;
    return rows[0] || null;
  }

  private async confirmPendingAction(ownerId: string, phone: string, actionType: string): Promise<{
    id: string;
    payload_json: any;
  } | null> {
    await this.expirePendingConfirmations(ownerId, phone);
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      payload_json: any;
    }>>`
      UPDATE owner_assistant_confirmations
      SET status = 'CONFIRMED',
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM owner_assistant_confirmations
        WHERE owner_id = ${ownerId}::uuid
          AND phone_number = ${phone}
          AND action_type = ${actionType}
          AND status = 'PENDING'
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id::text, payload_json
    `;
    return rows[0] || null;
  }

  private async cancelPendingConfirmation(ownerId: string, phone: string, actionType: string) {
    await this.expirePendingConfirmations(ownerId, phone);
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE owner_assistant_confirmations
      SET status = 'CANCELLED',
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM owner_assistant_confirmations
        WHERE owner_id = ${ownerId}::uuid
          AND phone_number = ${phone}
          AND action_type = ${actionType}
          AND status = 'PENDING'
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id::text
    `;
    return rows[0] || null;
  }

  private async expirePendingConfirmations(ownerId: string, phone: string) {
    await prisma.$executeRaw`
      UPDATE owner_assistant_confirmations
      SET status = 'EXPIRED',
          updated_at = now()
      WHERE owner_id = ${ownerId}::uuid
        AND phone_number = ${phone}
        AND status = 'PENDING'
        AND expires_at <= now()
    `;
  }

  private async updateConfirmationStatus(confirmationId: string, status: "COMPLETED" | "FAILED") {
    await prisma.$executeRaw`
      UPDATE owner_assistant_confirmations
      SET status = ${status},
          updated_at = now()
      WHERE id = ${confirmationId}::uuid
    `;
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

  private async notifyOwnerConnections(ownerId: string, text: string, excludePhones: string[] = []) {
    const excluded = new Set(excludePhones.map((phone) => normalizeWhatsAppPhone(phone)));
    let connections: OwnerWhatsAppConnection[] = [];
    try {
      connections = await this.listConnections(ownerId);
    } catch (error: any) {
      logger.warn("connections.notify_lookup_failed", {
        owner_id: ownerId,
        error: error?.message || String(error),
      });
      return;
    }

    for (const connection of connections) {
      const target = normalizeWhatsAppPhone(connection.phone_number);
      if (excluded.has(target)) continue;
      try {
        await this.getProvider().sendTextMessage(target, text);
      } catch (error: any) {
        logger.warn("connections.notify_failed", {
          owner_id: ownerId,
          phone: target,
          error: error?.message || String(error),
        });
      }
    }
  }

  private async countConnections(ownerId: string) {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM owner_whatsapp_identities
      WHERE owner_id = ${ownerId}::uuid
        AND is_verified = true
        AND phone_number IS NOT NULL
    `;
    return Number(rows[0]?.count || 0);
  }

  private buildConnectionChangedNotice(input: {
    event: "connected" | "disconnected";
    phone: string;
    connectedCount: number;
  }) {
    const verb = input.event === "connected" ? "connected to" : "disconnected from";
    const action = input.event === "connected" ? "connected" : "disconnected";
    return [
      "🔔 WhatsApp Assistant Updated",
      "",
      `An owner number was ${verb} Sri Adithya Hostels.`,
      "",
      `Number: ${maskWhatsAppPhone(input.phone)}`,
      `Connected Numbers: ${input.connectedCount}`,
      "",
      input.event === "connected"
        ? "If this was not expected, review:"
        : "If this was not expected, review:",
      "Settings → Automation → Owner WhatsApp Assistant",
      "",
      `Status: ${action}`,
    ].join("\n");
  }

  private async notifyDisconnectedNumber(ownerId: string, phone: string) {
    try {
      await this.getProvider().sendTextMessage(
        phone,
        [
          "Disconnected",
          "",
          "This WhatsApp number has been removed from the Owner Assistant.",
        ].join("\n")
      );
    } catch (error: any) {
      logger.warn("disconnect.notice_failed", {
        owner_id: ownerId,
        phone,
        error: error?.message || String(error),
      });
    }
  }

  private async respondAndLog(input: {
    ownerId: string | null;
    phone: string;
    message: string;
    command: string;
    response: string;
    success: boolean;
    buttons?: WhatsAppButton[];
    list?: {
      buttonText?: string;
      sections: WhatsAppListSection[];
    };
  }): Promise<InboundOwnerResult> {
    let responseSent = false;
    try {
      if (input.list) {
        try {
          await this.getProvider().sendListMessage(input.phone, input.response, input.list.sections, input.list.buttonText);
        } catch (interactiveError: any) {
          logger.warn("response.list_send_failed_fallback", {
            owner_id: input.ownerId,
            command: input.command,
            error: interactiveError?.message || String(interactiveError),
          });
          await this.getProvider().sendTextMessage(input.phone, this.withTextFallbackOptions(input.response, input.list.sections));
        }
      } else if (input.buttons?.length) {
        try {
          await this.getProvider().sendButtonMessage(input.phone, input.response, input.buttons);
        } catch (interactiveError: any) {
          logger.warn("response.button_send_failed_fallback", {
            owner_id: input.ownerId,
            command: input.command,
            error: interactiveError?.message || String(interactiveError),
          });
          await this.getProvider().sendTextMessage(input.phone, this.withButtonFallbackOptions(input.response, input.buttons));
        }
      } else {
        await this.getProvider().sendTextMessage(input.phone, input.response);
      }
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

  private withButtonFallbackOptions(response: string, buttons: WhatsAppButton[]) {
    const lines = buttons.map((button) => `${button.title}: ${button.id}`);
    return [response, "", "Options:", ...lines].join("\n");
  }

  private withTextFallbackOptions(response: string, sections: WhatsAppListSection[]) {
    const lines = sections.flatMap((section) => [
      section.title,
      ...section.rows.map((row) => `${row.title}: ${row.id}`),
    ]);
    return [response, "", "Options:", ...lines].join("\n");
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

  private async startInviteTenantFlow(ownerId: string, phone: string): Promise<InboundOwnerResult> {
    await setSelectionState(phone, {
      phone,
      action: "INVITE_TENANT",
      step: "AWAITING_NAME",
      data: {},
    });

    const response = [
      "Let's invite a new tenant.",
      "",
      "What is the tenant's full name?",
      "",
      "(Reply CANCEL at any time to abort)",
    ].join("\n");

    return this.respondAndLog({
      ownerId,
      phone,
      message: "INVITE",
      command: "INVITE_TENANT_INIT",
      response,
      success: true,
    });
  }

  private async handleInviteTenantStateFlow(
    ownerId: string,
    phone: string,
    message: string,
    state: InviteTenantSessionState
  ): Promise<InboundOwnerResult> {
    const input = message.trim();
    const inputUpper = input.toUpperCase();

    if (inputUpper === "CANCEL" || inputUpper === "CANCEL ") {
      await deleteSelectionState(phone);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_CANCEL",
        response: "❌ Invitation cancelled.",
        success: true,
      });
    }

    switch (state.step) {
      case "AWAITING_NAME": {
        const name = input;
        if (!name || name.length < 2) {
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_NAME_INVALID",
            response: "Name must be at least 2 characters. Please reply with the tenant's full name:",
            success: false,
          });
        }

        await setSelectionState(phone, {
          phone,
          action: "INVITE_TENANT",
          step: "AWAITING_PHONE",
          data: {
            ...state.data,
            name,
          },
        });

        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "INVITE_TENANT_NAME_SET",
          response: `Got it. Name: ${name}\n\nWhat is the tenant's phone number? (e.g. 9876543210)`,
          success: true,
        });
      }

      case "AWAITING_PHONE": {
        const normalized = normalizeIndianPhone(input);
        if (!normalized) {
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_PHONE_INVALID",
            response: "Invalid phone number. Please enter a valid 10-digit Indian mobile number:",
            success: false,
          });
        }

        // Check global phone uniqueness
        const uniqueness = await tenantInvitationLifecycleService.checkTenantPhoneUniqueness(normalized);
        if (!uniqueness.isUnique) {
          const activeExisting = await prisma.tenant_invitations.findFirst({
            where: {
              owner_id: ownerId,
              status: { in: ["SENT", "PENDING", "ACCEPTED"] },
              phone: normalized,
            },
          });

          await deleteSelectionState(phone);
          if (activeExisting) {
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_PHONE_DUPLICATE",
              response: `An active invitation already exists for +91 ${normalized.slice(-10)} (for '${activeExisting.name}'). Discarding current flow.`,
              success: false,
            });
          } else {
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_PHONE_DUPLICATE",
              response: `❌ Cannot invite: ${uniqueness.reason} Discarding current flow.`,
              success: false,
            });
          }
        }

        if (state.data.hostelId && state.data.roomId) {
          const room = await this.getOwnerRoom(ownerId, state.data.roomId);
          if (!room || room.hostel_id !== state.data.hostelId) {
            await deleteSelectionState(phone);
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_ROOM_INVALID",
              response: "Selected room is no longer available. Flow cancelled.",
              success: false,
            });
          }

          const cap = await roomCapacityService.getRoomCapacitySnapshot(room.id, { ownerId });
          if (cap.available <= 0) {
            await deleteSelectionState(phone);
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_NO_VACANCY",
              response: `Room ${room.room_no} has no vacant beds. Flow cancelled.`,
              success: false,
            });
          }

          const defaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(room.id, ownerId);
          const resolved = defaults.resolved_values;
          const maintenanceType = resolved.maintenance_type || "NONE";
          const maintenanceAmount = maintenanceType === "NONE" ? 0 : Number(resolved.maintenance_charge || 0);
          const maintenanceText = maintenanceType !== "NONE" && maintenanceAmount > 0
            ? `₹${maintenanceAmount.toLocaleString("en-IN")} (${maintenanceType.toLowerCase()})`
            : "N/A";

          await setSelectionState(phone, {
            phone,
            action: "INVITE_TENANT",
            step: "AWAITING_CONFIRMATION",
            data: {
              ...state.data,
              phone: normalized,
              roomId: room.id,
              roomNo: room.room_no,
              monthlyRent: resolved.monthly_rent,
              advanceDeposit: resolved.advance_deposit,
              maintenanceType,
              maintenanceAmount,
            },
          });

          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_ROOM_PRESELECTED",
            response: [
              "Please confirm invitation details:",
              "",
              `Tenant: ${state.data.name}`,
              `Phone: +91 ${normalized.slice(-10)}`,
              `Hostel: ${room.hostel_name}`,
              `Room: Room ${room.room_no}`,
              `Monthly Rent: ₹${resolved.monthly_rent.toLocaleString("en-IN")}`,
              `Security Deposit: ₹${resolved.advance_deposit.toLocaleString("en-IN")}`,
              `Maintenance Charge: ${maintenanceText}`,
              "",
              "Send invitation? Reply YES or NO.",
            ].join("\n"),
            success: true,
          });
        }

        const hostels = await prisma.hostels.findMany({
          where: { owner_id: ownerId, is_active: true },
          orderBy: { name: "asc" },
        });

        if (hostels.length === 0) {
          await deleteSelectionState(phone);
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_NO_HOSTELS",
            response: "No active hostels found. Register a hostel first.",
            success: false,
          });
        }

        const singleHostel = hostels.length === 1 ? hostels.find(() => true) : null;
        if (singleHostel) {
          const hostel = singleHostel;
          const rooms = await prisma.rooms.findMany({
            where: { hostel_id: hostel.id, is_active: true },
            orderBy: { room_no: "asc" },
          });

          const availableRooms: any[] = [];
          for (const r of rooms) {
            const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
            if (cap.available > 0) {
              availableRooms.push({ room: r, available: cap.available });
            }
          }

          if (availableRooms.length === 0) {
            await deleteSelectionState(phone);
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_NO_VACANCY",
              response: `No vacant beds available in ${hostel.name}. Flow cancelled.`,
              success: false,
            });
          }

          await setSelectionState(phone, {
            phone,
            action: "INVITE_TENANT",
            step: "AWAITING_ROOM",
            data: {
              ...state.data,
              phone: normalized,
              hostelId: hostel.id,
            },
          });

          const roomLines = availableRooms.map((ar, idx) => `${idx + 1}. Room ${ar.room.room_no} (${ar.available} vacant)`);
          const response = [
            `Selected Hostel: ${hostel.name}`,
            "",
            "Available Rooms:",
            ...roomLines,
            "",
            "Reply with the room number (e.g. 101) or list index:",
          ].join("\n");

          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_HOSTEL_AUTOSELECTED",
            response,
            success: true,
          });
        }

        // Multiple hostels
        await setSelectionState(phone, {
          phone,
          action: "INVITE_TENANT",
          step: "AWAITING_HOSTEL",
          data: {
            ...state.data,
            phone: normalized,
          },
        });

        const hostelLines = hostels.map((h, idx) => `${idx + 1}. ${h.name}`);
        const response = [
          "Select a Hostel:",
          ...hostelLines,
          "",
          "Reply with the hostel number (e.g. 1 or 2):",
        ].join("\n");

        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "INVITE_TENANT_AWAITING_HOSTEL",
          response,
          success: true,
        });
      }

      case "AWAITING_HOSTEL": {
        const hostels = await prisma.hostels.findMany({
          where: { owner_id: ownerId, is_active: true },
          orderBy: { name: "asc" },
        });

        let selectedHostel = null;
        const parsedIdx = parseInt(input, 10);
        if (!isNaN(parsedIdx) && parsedIdx >= 1 && parsedIdx <= hostels.length) {
          selectedHostel = hostels[parsedIdx - 1];
        } else {
          selectedHostel = hostels.find((h) => h.name.toLowerCase() === input.toLowerCase());
        }

        if (!selectedHostel) {
          const hostelLines = hostels.map((h, idx) => `${idx + 1}. ${h.name}`);
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_HOSTEL_INVALID",
            response: `Invalid selection. Please choose from the list:\n\n${hostelLines.join("\n")}`,
            success: false,
          });
        }

        const rooms = await prisma.rooms.findMany({
          where: { hostel_id: selectedHostel.id, is_active: true },
          orderBy: { room_no: "asc" },
        });

        const availableRooms: any[] = [];
        for (const r of rooms) {
          const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
          if (cap.available > 0) {
            availableRooms.push({ room: r, available: cap.available });
          }
        }

        if (availableRooms.length === 0) {
          await deleteSelectionState(phone);
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_NO_VACANCY",
            response: `No vacant beds available in ${selectedHostel.name}. Flow cancelled.`,
            success: false,
          });
        }

        await setSelectionState(phone, {
          phone,
          action: "INVITE_TENANT",
          step: "AWAITING_ROOM",
          data: {
            ...state.data,
            hostelId: selectedHostel.id,
          },
        });

        const roomLines = availableRooms.map((ar, idx) => `${idx + 1}. Room ${ar.room.room_no} (${ar.available} vacant)`);
        const response = [
          `Selected Hostel: ${selectedHostel.name}`,
          "",
          "Available Rooms:",
          ...roomLines,
          "",
          "Reply with the room number (e.g. 101) or list index:",
        ].join("\n");

        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "INVITE_TENANT_HOSTEL_SET",
          response,
          success: true,
        });
      }

      case "AWAITING_ROOM": {
        const hostelId = state.data.hostelId!;
        const rooms = await prisma.rooms.findMany({
          where: { hostel_id: hostelId, is_active: true },
          orderBy: { room_no: "asc" },
        });

        const availableRooms: any[] = [];
        for (const r of rooms) {
          const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
          if (cap.available > 0) {
            availableRooms.push({ room: r, available: cap.available });
          }
        }

        let selectedRoom = null;
        const parsedIdx = parseInt(input, 10);
        if (!isNaN(parsedIdx) && parsedIdx >= 1 && parsedIdx <= availableRooms.length) {
          selectedRoom = availableRooms[parsedIdx - 1].room;
        } else {
          const cleanInput = input.toLowerCase().replace(/^room\s+/, "").trim();
          selectedRoom = availableRooms.find((ar) => ar.room.room_no.toLowerCase().trim() === cleanInput)?.room;
        }

        if (!selectedRoom) {
          const roomLines = availableRooms.map((ar, idx) => `${idx + 1}. Room ${ar.room.room_no} (${ar.available} vacant)`);
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_ROOM_INVALID",
            response: `Invalid selection. Please choose from the available rooms:\n\n${roomLines.join("\n")}`,
            success: false,
          });
        }

        const defaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(selectedRoom.id, ownerId);
        const resolved = defaults.resolved_values;

        const maintenanceType = resolved.maintenance_type || "NONE";
        const maintenanceAmount = maintenanceType === "NONE" ? 0 : Number(resolved.maintenance_charge || 0);
        const maintenanceText = maintenanceType !== "NONE" && maintenanceAmount > 0
          ? `₹${maintenanceAmount.toLocaleString("en-IN")} (${maintenanceType.toLowerCase()})`
          : "N/A";

        const hostel = await prisma.hostels.findUnique({
          where: { id: hostelId },
          select: { name: true },
        });

        await setSelectionState(phone, {
          phone,
          action: "INVITE_TENANT",
          step: "AWAITING_CONFIRMATION",
          data: {
            ...state.data,
            roomId: selectedRoom.id,
            roomNo: selectedRoom.room_no,
            monthlyRent: resolved.monthly_rent,
            advanceDeposit: resolved.advance_deposit,
            maintenanceType,
            maintenanceAmount,
          },
        });

        const response = [
          "Please confirm invitation details:",
          "",
          `Tenant: ${state.data.name}`,
          `Phone: +91 ${state.data.phone?.slice(-10)}`,
          `Hostel: ${hostel?.name || "N/A"}`,
          `Room: Room ${selectedRoom.room_no}`,
          `Monthly Rent: ₹${resolved.monthly_rent.toLocaleString("en-IN")}`,
          `Security Deposit: ₹${resolved.advance_deposit.toLocaleString("en-IN")}`,
          `Maintenance Charge: ${maintenanceText}`,
          "",
          "Send invitation? Reply YES or NO.",
        ].join("\n");

        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "INVITE_TENANT_ROOM_SET",
          response,
          success: true,
        });
      }

      case "AWAITING_CONFIRMATION": {
        if (inputUpper === "YES" || inputUpper === "Y") {
          try {
            // Re-verify room capacity right before writing
            const cap = await roomCapacityService.getRoomCapacitySnapshot(state.data.roomId!, { ownerId });
            if (cap.available <= 0) {
              await deleteSelectionState(phone);
              return this.respondAndLog({
                ownerId,
                phone,
                message,
                command: "INVITE_TENANT_ERROR",
                response: "❌ Selected room is no longer vacant. Flow cancelled.",
                success: false,
              });
            }

            const invitePayload = {
              name: state.data.name,
              phone: state.data.phone,
              room_id: state.data.roomId,
              monthly_rent: state.data.monthlyRent,
              advance_deposit: state.data.advanceDeposit,
              maintenance_type: state.data.maintenanceType,
              maintenance_amount: state.data.maintenanceAmount,
            };

            await tenantInvitationLifecycleService.createInvitation(invitePayload, ownerId);
            await deleteSelectionState(phone);

            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_SUCCESS",
              response: `✅ Invitation sent successfully to ${state.data.name} via WhatsApp!`,
              success: true,
            });
          } catch (err: any) {
            await deleteSelectionState(phone);
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_ERROR",
              response: `❌ Failed to create invitation: ${err.message || String(err)}`,
              success: false,
            });
          }
        } else if (inputUpper === "NO" || inputUpper === "N") {
          await deleteSelectionState(phone);
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_CANCELLED",
            response: "❌ Invitation cancelled.",
            success: true,
          });
        } else {
          return this.respondAndLog({
            ownerId,
            phone,
            message,
            command: "INVITE_TENANT_CONFIRMATION_INVALID",
            response: "Please reply YES to send the invitation, or NO to cancel.",
            success: false,
          });
        }
      }
    }
  }

  private parseInviteMessage(message: string): ParsedInvite {
    const clean = message.trim();
    const lower = clean.toLowerCase();

    let remainder = "";
    if (lower.startsWith("invite tenant")) {
      remainder = clean.substring(13).trim();
    } else if (lower.startsWith("invite")) {
      remainder = clean.substring(6).trim();
    } else {
      return { raw: clean, tokens: [] };
    }

    if (!remainder) {
      return { raw: clean, tokens: [] };
    }

    let rawTokens: string[] = [];
    if (remainder.includes(",") || remainder.includes("|") || remainder.includes("/")) {
      const delimiter = remainder.includes(",") ? "," : remainder.includes("|") ? "|" : "/";
      rawTokens = remainder.split(delimiter).map((t) => t.trim()).filter(Boolean);
    } else {
      rawTokens = remainder.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    }

    let phoneToken: string | undefined;
    let phoneIdx = -1;
    for (let i = 0; i < rawTokens.length; i++) {
      const tok = rawTokens[i];
      const stripped = tok.replace(/[^0-9+]/g, "");
      if (/^\+?\d{10,13}$/.test(stripped)) {
        phoneToken = tok;
        phoneIdx = i;
        break;
      }
    }

    let name: string | undefined;
    let remainingTokens: string[] = [];

    if (phoneIdx !== -1) {
      const nameTokens = rawTokens.slice(0, phoneIdx);
      if (nameTokens.length > 0) {
        name = nameTokens.join(" ");
      }
      remainingTokens = rawTokens.slice(phoneIdx + 1);
    } else {
      name = rawTokens.join(" ");
    }

    return {
      raw: clean,
      name,
      phone: phoneToken,
      tokens: remainingTokens,
    };
  }

  private async handleStructuredInviteCommand(
    ownerId: string,
    phone: string,
    message: string
  ): Promise<InboundOwnerResult> {
    const parsed = this.parseInviteMessage(message);

    if (!parsed.name && !parsed.phone && parsed.tokens.length === 0) {
      return this.startInviteTenantFlow(ownerId, phone);
    }

    const data: any = {};

    if (parsed.name && parsed.name.length >= 2) {
      data.name = parsed.name;
    }

    if (parsed.phone) {
      const normalized = normalizeIndianPhone(parsed.phone);
      if (normalized) {
        // Check global phone uniqueness
        const uniqueness = await tenantInvitationLifecycleService.checkTenantPhoneUniqueness(normalized);
        if (!uniqueness.isUnique) {
          const activeExisting = await prisma.tenant_invitations.findFirst({
            where: {
              owner_id: ownerId,
              status: { in: ["SENT", "PENDING", "ACCEPTED"] },
              phone: normalized,
            },
          });

          await deleteSelectionState(phone);
          if (activeExisting) {
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_PHONE_DUPLICATE",
              response: `An active invitation already exists for +91 ${normalized.slice(-10)} (for '${activeExisting.name}'). Discarding current flow.`,
              success: false,
            });
          } else {
            return this.respondAndLog({
              ownerId,
              phone,
              message,
              command: "INVITE_TENANT_PHONE_DUPLICATE",
              response: `❌ Cannot invite: ${uniqueness.reason} Discarding current flow.`,
              success: false,
            });
          }
        }
        data.phone = normalized;
      }
    }

    const hostels = await prisma.hostels.findMany({
      where: { owner_id: ownerId, is_active: true },
      orderBy: { name: "asc" },
    });

    if (hostels.length === 0) {
      await deleteSelectionState(phone);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_NO_HOSTELS",
        response: "No active hostels found. Register a hostel first.",
        success: false,
      });
    }

    let resolvedHostelId: string | undefined;
    let resolvedRoomId: string | undefined;
    let resolvedRoomNo: string | undefined;

    const singleHostel = hostels.length === 1 ? hostels.find(() => true) : null;
    if (singleHostel) {
      resolvedHostelId = singleHostel.id;
      if (parsed.tokens.length > 0) {
        const roomToken = parsed.tokens[0];
        const cleanRoomToken = roomToken.toLowerCase().replace(/^room\s+/, "").trim();

        const rooms = await prisma.rooms.findMany({
          where: { hostel_id: resolvedHostelId, is_active: true },
          orderBy: { room_no: "asc" },
        });

        const availableRooms: any[] = [];
        for (const r of rooms) {
          const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
          if (cap.available > 0) {
            availableRooms.push(r);
          }
        }

        const selectedRoom = availableRooms.find(
          (r) => r.room_no.toLowerCase().trim() === cleanRoomToken
        );
        if (selectedRoom) {
          resolvedRoomId = selectedRoom.id;
          resolvedRoomNo = selectedRoom.room_no;
        }
      }
    } else if (hostels.length > 1) {
      if (parsed.tokens.length >= 2) {
        const roomToken = parsed.tokens[parsed.tokens.length - 1];
        const cleanRoomToken = roomToken.toLowerCase().replace(/^room\s+/, "").trim();

        const hostelToken = parsed.tokens.slice(0, parsed.tokens.length - 1).join(" ").toLowerCase();
        const matchedHostel = hostels.find(
          (h) =>
            h.name.toLowerCase() === hostelToken ||
            h.name.toLowerCase().includes(hostelToken) ||
            hostelToken.includes(h.name.toLowerCase())
        );
        if (matchedHostel) {
          resolvedHostelId = matchedHostel.id;

          const rooms = await prisma.rooms.findMany({
            where: { hostel_id: resolvedHostelId, is_active: true },
            orderBy: { room_no: "asc" },
          });

          const availableRooms: any[] = [];
          for (const r of rooms) {
            const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
            if (cap.available > 0) {
              availableRooms.push(r);
            }
          }

          const selectedRoom = availableRooms.find(
            (r) => r.room_no.toLowerCase().trim() === cleanRoomToken
          );
          if (selectedRoom) {
            resolvedRoomId = selectedRoom.id;
            resolvedRoomNo = selectedRoom.room_no;
          }
        }
      } else if (parsed.tokens.length === 1) {
        const token = parsed.tokens[0].toLowerCase();
        const matchedHostel = hostels.find(
          (h) =>
            h.name.toLowerCase() === token ||
            h.name.toLowerCase().includes(token) ||
            token.includes(h.name.toLowerCase())
        );
        if (matchedHostel) {
          resolvedHostelId = matchedHostel.id;
        } else {
          const cleanRoomToken = token.replace(/^room\s+/, "").trim();
          const matchedRooms: { room: any; hostel: any }[] = [];

          for (const hostel of hostels) {
            const rooms = await prisma.rooms.findMany({
              where: { hostel_id: hostel.id, is_active: true },
            });
            for (const r of rooms) {
              if (r.room_no.toLowerCase().trim() === cleanRoomToken) {
                const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
                if (cap.available > 0) {
                  matchedRooms.push({ room: r, hostel });
                }
              }
            }
          }

          if (matchedRooms.length === 1) {
            resolvedHostelId = matchedRooms[0].hostel.id;
            resolvedRoomId = matchedRooms[0].room.id;
            resolvedRoomNo = matchedRooms[0].room.room_no;
          }
        }
      }
    }

    if (resolvedHostelId) data.hostelId = resolvedHostelId;
    if (resolvedRoomId) {
      data.roomId = resolvedRoomId;
      data.roomNo = resolvedRoomNo;
    }

    if (!data.name) {
      await setSelectionState(phone, {
        phone,
        action: "INVITE_TENANT",
        step: "AWAITING_NAME",
        data,
      });

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_INIT",
        response: [
          "Let's invite a new tenant.",
          "",
          "What is the tenant's full name?",
          "",
          "(Reply CANCEL at any time to abort)",
        ].join("\n"),
        success: true,
      });
    }

    if (!data.phone) {
      await setSelectionState(phone, {
        phone,
        action: "INVITE_TENANT",
        step: "AWAITING_PHONE",
        data,
      });

      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_NAME_SET",
        response: `Got it. Name: ${data.name}\n\nWhat is the tenant's phone number? (e.g. 9876543210)`,
        success: true,
      });
    }

    if (!data.hostelId) {
      await setSelectionState(phone, {
        phone,
        action: "INVITE_TENANT",
        step: "AWAITING_HOSTEL",
        data,
      });

      const hostelLines = hostels.map((h, idx) => `${idx + 1}. ${h.name}`);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_AWAITING_HOSTEL",
        response: [
          "Select a Hostel:",
          ...hostelLines,
          "",
          "Reply with the hostel number (e.g. 1 or 2):",
        ].join("\n"),
        success: true,
      });
    }

    if (!data.roomId) {
      await setSelectionState(phone, {
        phone,
        action: "INVITE_TENANT",
        step: "AWAITING_ROOM",
        data,
      });

      const hostel = hostels.find((h) => h.id === data.hostelId);
      const rooms = await prisma.rooms.findMany({
        where: { hostel_id: data.hostelId, is_active: true },
        orderBy: { room_no: "asc" },
      });

      const availableRooms: any[] = [];
      for (const r of rooms) {
        const cap = await roomCapacityService.getRoomCapacitySnapshot(r.id, { ownerId });
        if (cap.available > 0) {
          availableRooms.push({ room: r, available: cap.available });
        }
      }

      if (availableRooms.length === 0) {
        await deleteSelectionState(phone);
        return this.respondAndLog({
          ownerId,
          phone,
          message,
          command: "INVITE_TENANT_NO_VACANCY",
          response: `No vacant beds available in ${hostel?.name || "selected hostel"}. Flow cancelled.`,
          success: false,
        });
      }

      const roomLines = availableRooms.map((ar, idx) => `${idx + 1}. Room ${ar.room.room_no} (${ar.available} vacant)`);
      return this.respondAndLog({
        ownerId,
        phone,
        message,
        command: "INVITE_TENANT_HOSTEL_SET",
        response: [
          `Selected Hostel: ${hostel?.name || "N/A"}`,
          "",
          "Available Rooms:",
          ...roomLines,
          "",
          "Reply with the room number (e.g. 101) or list index:",
        ].join("\n"),
        success: true,
      });
    }

    const defaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(data.roomId, ownerId);
    const resolved = defaults.resolved_values;

    const maintenanceType = resolved.maintenance_type || "NONE";
    const maintenanceAmount = maintenanceType === "NONE" ? 0 : Number(resolved.maintenance_charge || 0);
    const maintenanceText = maintenanceType !== "NONE" && maintenanceAmount > 0
      ? `₹${maintenanceAmount.toLocaleString("en-IN")} (${maintenanceType.toLowerCase()})`
      : "N/A";

    const hostel = hostels.find((h) => h.id === data.hostelId);

    await setSelectionState(phone, {
      phone,
      action: "INVITE_TENANT",
      step: "AWAITING_CONFIRMATION",
      data: {
        ...data,
        monthlyRent: resolved.monthly_rent,
        advanceDeposit: resolved.advance_deposit,
        maintenanceType,
        maintenanceAmount,
      },
    });

    return this.respondAndLog({
      ownerId,
      phone,
      message,
      command: "INVITE_TENANT_ROOM_SET",
      response: [
        "Please confirm invitation details:",
        "",
        `Tenant: ${data.name}`,
        `Phone: +91 ${data.phone.slice(-10)}`,
        `Hostel: ${hostel?.name || "N/A"}`,
        `Room: Room ${data.roomNo}`,
        `Monthly Rent: ₹${resolved.monthly_rent.toLocaleString("en-IN")}`,
        `Security Deposit: ₹${resolved.advance_deposit.toLocaleString("en-IN")}`,
        `Maintenance Charge: ${maintenanceText}`,
        "",
        "Send invitation? Reply YES or NO.",
      ].join("\n"),
      success: true,
    });
  }

  private getProvider() {
    if (!this.provider) {
      this.provider = new MetaWhatsAppProvider();
    }
    return this.provider;
  }
}

export const ownerWhatsAppAssistantService = new OwnerWhatsAppAssistantService();
