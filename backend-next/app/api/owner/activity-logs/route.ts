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
    const actorIds = Array.from(new Set(logs.map((l: any) => l.user_id)));
    const profiles = await prisma.profile.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

    // Fetch hostel names if we want to display hostel context nicely
    const hostelIds = Array.from(
      new Set(
        logs
          .map((l: any) => (l.metadata as any)?.hostel_id)
          .filter(Boolean) as string[]
      )
    );
    const hostels = await prisma.hostels.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    const hostelMap = new Map(hostels.map((h: any) => [h.id, h.name]));

    // Gather all tenant_ids and allocation_ids for enrichment
    const tenantIds: string[] = [];
    const allocationIds: string[] = [];
    logs.forEach((log: any) => {
      const meta = (log.metadata as any) || {};
      if (meta.tenant_id) tenantIds.push(meta.tenant_id);
      if (meta.allocation_id) allocationIds.push(meta.allocation_id);
    });

    // Fetch tenant profiles
    const tenants = tenantIds.length > 0 ? await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        profiles: {
          select: { name: true }
        }
      }
    }) : [];
    const tenantNameMap = new Map<string, string>();
    tenants.forEach((t: any) => {
      if (t.profiles?.name) {
        tenantNameMap.set(t.id, t.profiles.name);
      }
    });

    // Fetch allocations and their room numbers
    const allocations = allocationIds.length > 0 ? await prisma.roomAllocation.findMany({
      where: { id: { in: allocationIds } },
      include: {
        room: {
          select: { room_no: true }
        }
      }
    }) : [];
    const allocationRoomMap = new Map<string, string>();
    allocations.forEach((a: any) => {
      if (a.room?.room_no) {
        allocationRoomMap.set(a.id, a.room.room_no);
      }
    });

    // Fetch all allocations for these tenants to determine room transitions (e.g. G1 -> G2)
    const allTenantAllocations = tenantIds.length > 0 ? await prisma.roomAllocation.findMany({
      where: { tenant_id: { in: tenantIds } },
      include: {
        room: {
          select: { room_no: true }
        }
      },
      orderBy: { start_date: "asc" }
    }) : [];
    const tenantAllocationsMap = new Map<string, typeof allTenantAllocations>();
    allTenantAllocations.forEach((alloc: any) => {
      if (!tenantAllocationsMap.has(alloc.tenant_id)) {
        tenantAllocationsMap.set(alloc.tenant_id, []);
      }
      tenantAllocationsMap.get(alloc.tenant_id)!.push(alloc);
    });

    // Enrich logs
    let enrichedLogs = logs.map((log: any) => {
      const meta = { ...((log.metadata as any) || {}) };
      const logHostelId = meta.hostel_id || null;

      if (log.entity_type === "ROOM" && log.action_type === "ALLOCATE") {
        if (meta.tenant_id) {
          const tenantName = tenantNameMap.get(meta.tenant_id) || "Unknown Tenant";
          const currentRoomNo = allocationRoomMap.get(meta.allocation_id) || "Room";
          
          let roomsStr = currentRoomNo;
          const tAllocs = tenantAllocationsMap.get(meta.tenant_id) || [];
          const currentIdx = tAllocs.findIndex((a: any) => a.id === meta.allocation_id);
          if (currentIdx > 0) {
            const prevRoomNo = tAllocs[currentIdx - 1].room?.room_no || "Room";
            roomsStr = `${prevRoomNo} -> ${currentRoomNo}`;
          } else {
            roomsStr = `None -> ${currentRoomNo}`;
          }

          // Populate friendly UI fields
          meta.tenant_name = tenantName;
          meta.rooms = roomsStr;

          // For the compact log subtitle
          meta.name = tenantName;
          meta.room_no = currentRoomNo;
        }
      }

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
        (log: any) =>
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
