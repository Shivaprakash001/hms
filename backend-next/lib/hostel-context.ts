/**
 * 🏗️ Hostel Operational Context — SINGLE SOURCE OF TRUTH (v2)
 *
 * Replaces implicit `getPreferences(ownerId)` with an explicitly hostel-scoped
 * context object. All operational services (reminders, receipts, rent generation,
 * payments) MUST use this module when they need hostel-level config.
 *
 * ARCHITECTURE RULE:
 *   `findFirst({ where: { owner_id } })` is BANNED for operational hostel resolution.
 *   All calls must resolve an explicit hostelId from the entity chain first.
 *
 * BACKWARD COMPATIBILITY:
 *   `getPreferences(ownerId)` still works for single-hostel owners (returns the
 *   one active hostel). It now logs a deprecation warning so we can track all
 *   remaining callers and migrate them.
 */

import { prisma } from "./db";
import { resolvePreferences, type HostelPreferences } from "./preferences";

// ─── Hostel Operational Context ────────────────────────────────────────────────

export interface HostelOperationalContext {
  /** The resolved hostel record */
  hostel: {
    id: string;
    owner_id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    gst_number: string | null;
    upi_id: string | null;
    logo_url: string | null;
    receipt_prefix: string | null;
    timezone: string | null;
    currency: string | null;
    is_active: boolean;
  };
  /** Fully resolved preferences for this hostel (typed, defaulted) */
  prefs: HostelPreferences;
}

/**
 * Primary entry point for any service needing hostel-scoped operational config.
 *
 * Validates that:
 * - hostelId is provided (rejects implicit resolution)
 * - hostel exists and is active
 * - hostel belongs to the given owner (prevents cross-owner access)
 *
 * Throws structured errors — callers should handle:
 *   HOSTEL_CONTEXT_REQUIRED  — hostelId was not provided
 *   HOSTEL_NOT_FOUND         — hostel doesn't exist or is inactive
 *   HOSTEL_ACCESS_DENIED     — hostel does not belong to this owner
 */
export async function getHostelOperationalContext(
  ownerId: string,
  hostelId: string,
): Promise<HostelOperationalContext> {
  if (!hostelId) {
    const err: any = new Error(
      "HOSTEL_CONTEXT_REQUIRED: hostelId must be provided explicitly. " +
      "Implicit hostel resolution via findFirst(owner_id) is prohibited. " +
      "Resolve hostelId from the entity chain (tenant→allocation→room→hostel) first."
    );
    err.code = "HOSTEL_CONTEXT_REQUIRED";
    throw err;
  }

  const hostel = await prisma.hostel.findUnique({
    where: { id: hostelId },
    select: {
      id: true,
      owner_id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      gst_number: true,
      upi_id: true,
      logo_url: true,
      receipt_prefix: true,
      timezone: true,
      currency: true,
      is_active: true,
      // Preferences blob + typed columns needed for resolvePreferences
      preferences_config: true,
      rent_cycle: true,
      auto_rent_day: true,
    },
  });

  if (!hostel || !hostel.is_active) {
    const err: any = new Error(`HOSTEL_NOT_FOUND: Hostel ${hostelId} does not exist or is not active.`);
    err.code = "HOSTEL_NOT_FOUND";
    throw err;
  }

  if (hostel.owner_id !== ownerId) {
    const err: any = new Error(`HOSTEL_ACCESS_DENIED: Hostel ${hostelId} does not belong to owner ${ownerId}.`);
    err.code = "HOSTEL_ACCESS_DENIED";
    throw err;
  }

  return {
    hostel: hostel as HostelOperationalContext["hostel"],
    prefs: resolvePreferences(hostel),
  };
}

/**
 * Resolve hostelId from a tenant's current active room allocation.
 *
 * Use this when you have a tenantId but no hostelId.
 * Returns null if the tenant has no active allocation (e.g. just invited).
 *
 * Entity chain: tenant → room_allocation (is_active=true) → room → hostel
 */
export async function resolveHostelIdFromTenant(tenantId: string): Promise<string | null> {
  const allocation = await prisma.roomAllocation.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    select: { room: { select: { hostel_id: true } } },
    orderBy: { start_date: "desc" },
  });

  const derived = allocation?.room?.hostel_id ?? null;

  // ── Phase 2: Dual-Read Validation ──
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { hostel_id: true }
    });
    const stored = tenant?.hostel_id ?? null;
    
    if (derived !== stored) {
      console.log(`[HOSTEL_VALIDATION] tenant_id=${tenantId} derived=${derived || "NULL"} stored=${stored || "NULL"} ❌ MISMATCH`);
    } else {
      console.log(`[HOSTEL_VALIDATION] tenant_id=${tenantId} derived=${derived || "NULL"} stored=${stored || "NULL"} ✅`);
    }
  } catch (err) {
    console.error("[HOSTEL_VALIDATION] Failed to dual-read tenant", err);
  }

  return derived;
}

/**
 * Resolve hostelId from a rent obligation's allocation chain.
 *
 * Use this in the reminder service when iterating obligations.
 * Prefers allocation_id path (already on the obligation) for efficiency.
 */
export async function resolveHostelIdFromObligation(
  obligationId: string,
  allocationId: string | null,
  tenantId: string,
): Promise<string | null> {
  let derived: string | null = null;
  // Fast path: obligation has allocation_id
  if (allocationId) {
    const allocation = await prisma.roomAllocation.findUnique({
      where: { id: allocationId },
      select: { room: { select: { hostel_id: true } } },
    });
    if (allocation?.room?.hostel_id) derived = allocation.room.hostel_id;
  }

  // Fallback: resolve from tenant's current active allocation
  if (!derived) {
    derived = await resolveHostelIdFromTenant(tenantId);
  }

  // ── Phase 2: Dual-Read Validation ──
  try {
    const obligation = await prisma.rentObligation.findUnique({
      where: { id: obligationId },
      select: { hostel_id: true }
    });
    const stored = obligation?.hostel_id ?? null;
    
    if (derived !== stored) {
      console.log(`[HOSTEL_VALIDATION] obligation_id=${obligationId} derived=${derived || "NULL"} stored=${stored || "NULL"} ❌ MISMATCH`);
    } else {
      console.log(`[HOSTEL_VALIDATION] obligation_id=${obligationId} derived=${derived || "NULL"} stored=${stored || "NULL"} ✅`);
    }
  } catch (err) {
    console.error("[HOSTEL_VALIDATION] Failed to dual-read obligation", err);
  }

  return derived;
}

/**
 * Build a hostelId → HostelOperationalContext map for a batch of hostel IDs.
 *
 * Used by the reminder service to batch-load hostel configs for all obligations
 * in one query instead of N individual lookups.
 */
export async function batchGetHostelContexts(
  hostelIds: string[],
  ownerId?: string,
): Promise<Map<string, HostelOperationalContext>> {
  const uniqueIds = Array.from(new Set(hostelIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const hostels = await prisma.hostel.findMany({
    where: {
      id: { in: uniqueIds },
      is_active: true,
      ...(ownerId ? { owner_id: ownerId } : {}),
    },
    select: {
      id: true,
      owner_id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      gst_number: true,
      upi_id: true,
      logo_url: true,
      receipt_prefix: true,
      timezone: true,
      currency: true,
      is_active: true,
      preferences_config: true,
      rent_cycle: true,
      auto_rent_day: true,
    },
  });

  const map = new Map<string, HostelOperationalContext>();
  for (const hostel of hostels) {
    map.set(hostel.id, {
      hostel: hostel as HostelOperationalContext["hostel"],
      prefs: resolvePreferences(hostel),
    });
  }
  return map;
}
