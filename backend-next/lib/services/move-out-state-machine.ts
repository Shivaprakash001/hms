/**
 * Move-Out State Machine — SINGLE SOURCE OF TRUTH
 *
 * ARCHITECTURE RULE:
 *   Direct `status = "COMPLETED"` writes are BANNED.
 *   All transitions MUST go through `assertTransition()`.
 *
 * This module defines:
 *   1. Valid state transitions (the graph)
 *   2. Capability guards (what actions are allowed/blocked per state)
 *   3. Tenant-facing step mapping (hides internal complexity)
 */

import { MoveOutStatus } from "@prisma/client";
import { prisma } from "../db";

// ─── Transition Graph ──────────────────────────────────────────

const TRANSITIONS: Record<MoveOutStatus, MoveOutStatus[]> = {
  REQUESTED:           ["SETTLEMENT_PENDING", "REJECTED"],
  SETTLEMENT_PENDING:  ["APPROVED", "REJECTED"],
  APPROVED:            ["VACATED"],
  VACATED:             ["COMPLETED"],
  COMPLETED:           [],
  REJECTED:            [],
};

/**
 * Assert that a transition from `current` to `next` is valid.
 * Throws a structured error if not.
 */
export function assertTransition(current: MoveOutStatus, next: MoveOutStatus): void {
  const allowed = TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(
      `INVALID_TRANSITION: Cannot move from ${current} to ${next}. ` +
      `Allowed transitions from ${current}: [${(allowed || []).join(", ")}]`
    );
  }
}

/**
 * Check if a transition is valid without throwing.
 */
export function canTransition(current: MoveOutStatus, next: MoveOutStatus): boolean {
  return (TRANSITIONS[current] || []).includes(next);
}

// ─── Capability Guards ─────────────────────────────────────────
// Replaces boolean freeze flags with centralized permission checks.
// Every service that needs to check "can I do X for this tenant?"
// calls these instead of reading raw flags.

type Capability =
  | "TRANSFER_ROOM"
  | "GENERATE_RENT"
  | "EDIT_PROFILE"
  | "MODIFY_RENT_AMOUNT"
  | "CHANGE_ROOMMATE"
  | "RAISE_DISPUTE"
  | "SUBMIT_FEEDBACK"
  | "CANCEL_REQUEST";

const BLOCKED_CAPABILITIES: Record<MoveOutStatus, Capability[]> = {
  REQUESTED:           ["TRANSFER_ROOM", "MODIFY_RENT_AMOUNT", "CHANGE_ROOMMATE", "EDIT_PROFILE"],
  SETTLEMENT_PENDING:  ["TRANSFER_ROOM", "MODIFY_RENT_AMOUNT", "CHANGE_ROOMMATE", "EDIT_PROFILE"],
  APPROVED:            ["TRANSFER_ROOM", "MODIFY_RENT_AMOUNT", "CHANGE_ROOMMATE", "EDIT_PROFILE"],
  VACATED:             ["TRANSFER_ROOM", "GENERATE_RENT", "MODIFY_RENT_AMOUNT", "CHANGE_ROOMMATE", "EDIT_PROFILE"],
  COMPLETED:           ["TRANSFER_ROOM", "GENERATE_RENT", "MODIFY_RENT_AMOUNT", "CHANGE_ROOMMATE", "EDIT_PROFILE", "CANCEL_REQUEST"],
  REJECTED:            [],
};

/**
 * Check if a tenant has an active move-out that blocks the given capability.
 * Returns null if no active move-out exists (capability is allowed).
 * Returns the blocking request ID and status if blocked.
 */
export async function checkCapability(
  tenantId: string,
  capability: Capability,
): Promise<{ blocked: false } | { blocked: true; requestId: string; status: MoveOutStatus; reason: string }> {
  const active = await prisma.move_out_requests.findFirst({
    where: {
      tenant_id: tenantId,
      status: { notIn: ["COMPLETED", "REJECTED"] },
    },
    select: { id: true, status: true },
    orderBy: { created_at: "desc" },
  });

  if (!active) return { blocked: false };

  const blocked = (BLOCKED_CAPABILITIES[active.status as MoveOutStatus] || []).includes(capability);
  if (!blocked) return { blocked: false };

  return {
    blocked: true,
    requestId: active.id,
    status: active.status,
    reason: `${capability} is blocked during move-out (status: ${active.status}, request: ${active.id})`,
  };
}

/**
 * Assert capability — throws if blocked. Use in services.
 */
export async function assertCapability(tenantId: string, capability: Capability): Promise<void> {
  const result = await checkCapability(tenantId, capability);
  if (result.blocked) {
    const err: any = new Error(`FROZEN: ${result.reason}`);
    err.code = "MOVE_OUT_FREEZE";
    err.requestId = result.requestId;
    err.status = result.status;
    throw err;
  }
}

// ─── Tenant-Facing Step Mapping ────────────────────────────────
// Maps internal workflow states to simple, anxiety-reducing steps.

export interface TenantStep {
  step: number;
  label: string;
  description: string;
  icon: string;
  active: boolean;
  completed: boolean;
}

const TENANT_STEPS = [
  { label: "Request Submitted",     icon: "📋", description: "Your move-out request has been received." },
  { label: "Settlement Pending",    icon: "💰", description: "Reviewing dues and calculating final settlement." },
  { label: "Move-Out Approved",     icon: "✅", description: "Move-out approved. Awaiting physical vacate." },
  { label: "Bed Vacated",           icon: "🚪", description: "Bed vacated. Awaiting final deposit settlement." },
  { label: "Exit Completed",        icon: "🏁", description: "Your move-out is complete. Thank you!" },
];

const STATUS_TO_STEP: Record<string, number> = {
  REQUESTED: 0,
  SETTLEMENT_PENDING: 1,
  APPROVED: 2,
  VACATED: 3,
  COMPLETED: 4,
  REJECTED: -1,
};

export function getTenantSteps(currentStatus: MoveOutStatus): TenantStep[] {
  const currentIdx = STATUS_TO_STEP[currentStatus] ?? -1;
  return TENANT_STEPS.map((step, i) => ({
    step: i + 1,
    label: step.label,
    description: step.description,
    icon: step.icon,
    active: i === currentIdx,
    completed: i < currentIdx,
  }));
}

// ─── Terminal States ───────────────────────────────────────────

export function isTerminal(status: MoveOutStatus): boolean {
  return ["COMPLETED", "REJECTED"].includes(status);
}

export function isActive(status: MoveOutStatus): boolean {
  return !isTerminal(status);
}
