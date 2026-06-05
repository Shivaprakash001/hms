export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { prisma } from "@/lib/db";

/**
 * GET /api/owner/activity-logs
 * Fetch all audit trail activity logs for an owner, with optional filters.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const scope = resolveOwnerScope(session);
  const { searchParams } = new URL(req.url);

  const hostelId = searchParams.get("hostelId") || undefined;
  const actionType = searchParams.get("actionType") || undefined;
  const entityType = searchParams.get("entityType") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50")));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

  try {
    // Build filter query
    const where: any = {
      owner_id: scope.owner_id,
    };

    if (actionType) {
      where.action_type = actionType;
    }
    if (entityType) {
      where.entity_type = entityType;
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (hostelId) {
      where.metadata = {
        path: ["hostel_id"],
        equals: hostelId,
      };
    }

    // Query DB
    const [logs, total] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activity_logs.count({ where }),
    ]);

    // Fetch actor profile details
    const actorIds = Array.from(new Set(logs.map((l) => l.user_id)));
    const profiles = await prisma.profile.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Fetch hostel names if we want to display hostel context nicely
    const hostelIds = Array.from(
      new Set(
        logs
          .map((l) => (l.metadata as any)?.hostel_id)
          .filter(Boolean) as string[]
      )
    );
    const hostels = await prisma.hostels.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    const hostelMap = new Map(hostels.map((h) => [h.id, h.name]));

    // Enrich logs
    let enrichedLogs = logs.map((log) => {
      const meta = (log.metadata as any) || {};
      const logHostelId = meta.hostel_id || null;
      return {
        id: log.id,
        action_type: log.action_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        timestamp: log.timestamp,
        metadata: meta,
        hostel_name: logHostelId ? hostelMap.get(logHostelId) || "Hostel" : null,
        actor: profileMap.get(log.user_id) || { name: "System", email: "" },
      };
    });

    // Apply search filter in-memory if query parameter exists
    if (search) {
      const q = search.toLowerCase();
      enrichedLogs = enrichedLogs.filter(
        (log) =>
          log.actor.name.toLowerCase().includes(q) ||
          log.action_type.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          (log.hostel_name && log.hostel_name.toLowerCase().includes(q)) ||
          JSON.stringify(log.metadata).toLowerCase().includes(q)
      );
    }

    return apiResponse({
      items: enrichedLogs,
      total: search ? enrichedLogs.length : total,
    });
  } catch (error: any) {
    console.error("Failed to query activity logs:", error);
    return apiError(error.message || "Failed to fetch activity logs");
  }
}
