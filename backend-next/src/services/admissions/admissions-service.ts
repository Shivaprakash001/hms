import { prisma } from "@/lib/db";
import { ApiError } from "@/src/lib/api-error";
import { normalizeIndianPhone } from "@/lib/utils/phone-utils";
import { checkFixedWindowLimit } from "@/lib/redis/rate-limit";
import { redisKeys } from "@/lib/redis/keys";
import { getOrSetJson, invalidateTag } from "@/lib/redis/cache";
import { invitationService } from "@/src/services/tenants/invitation-service";

export const LEAD_STATUSES = [
  "NEW",
  "INTERESTED",
  "FOLLOW_UP",
  "READY_TO_JOIN",
  "INVITED",
  "JOINED",
  "LOST",
] as const;

export const LOST_REASONS = [
  "TOO_EXPENSIVE",
  "NO_VACANCY",
  "FOOD_CONCERN",
  "LOCATION",
  "PARENT_REJECTED",
  "JOINED_OTHER_HOSTEL",
  "NO_RESPONSE",
  "COLLEGE_CHANGED",
  "OTHER",
] as const;

export const ACTIVITY_SCORES: Record<string, number> = {
  VIEW_HOSTEL: 0,
  VIEW_ROOM: 5,
  VIEW_PRICING: 10,
  VIEW_RULES: 5,
  VIEW_FACILITIES: 0,
  VIEW_FOOD: 0,
  MARK_INTEREST: 20,
  SHARE_LINK: 0,
  REQUEST_JOIN: 30,
  RESERVE_ROOM: 50,
};

const ACTIVE_LEAD_STATUSES = ["NEW", "INTERESTED", "FOLLOW_UP", "READY_TO_JOIN", "INVITED"];
const RESERVATION_COOLDOWN_HOURS = 12;

function cleanString(value: unknown, max = 200) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function leadTemperature(score: number) {
  if (score >= 70) return "Hot";
  if (score >= 30) return "Warm";
  return "Cold";
}

function readinessForHostel(hostel: any, rooms: any[]) {
  const hostelPhotoCount = asArray(hostel.admission_photos).length + (hostel.logo_url ? 1 : 0);
  const roomCategories = new Map<string, number>();
  for (const room of rooms) {
    const category = room.room_type || "Standard";
    roomCategories.set(category, Math.max(roomCategories.get(category) || 0, asArray(room.admission_photos).length));
  }

  const checks = {
    hostel_information: Boolean(hostel.name && hostel.phone && hostel.address),
    pricing: rooms.some((room) => Number(room.base_rent || 0) > 0),
    facilities: Boolean(hostel.preferences_config),
    hostel_photos: hostelPhotoCount >= 5,
    room_photos: roomCategories.size > 0 && Array.from(roomCategories.values()).every((count) => count >= 2),
  };

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
  };
}

function publicRoom(room: any) {
  const activeAllocations = room.room_allocations || [];
  const activeReservations = room.room_reservations || [];
  const occupied = activeAllocations.length;
  const reserved = activeReservations.length;
  const availableBeds = Math.max(0, Number(room.capacity || 0) - occupied - reserved);
  return {
    id: room.id,
    room_no: room.room_no,
    floor: room.floor,
    floor_name: room.floor_ref?.name || null,
    room_type: room.room_type || "Standard",
    capacity: room.capacity,
    occupied_count: occupied,
    reserved_count: reserved,
    available_beds: availableBeds,
    pricing: {
      monthly_rent: Number(room.base_rent || 0),
      deposit: null,
      maintenance: null,
    },
    notes: room.notes || null,
    photos: asArray(room.admission_photos),
    roommate_preview: activeAllocations
      .map((allocation: any) => allocation.tenant)
      .filter(Boolean)
      .map((tenant: any) => ({
        college: tenant.college_name || null,
        course: tenant.course || null,
        year: tenant.year_of_study || null,
      }))
      .filter((item: any) => item.college || item.course || item.year),
  };
}

async function ensureHostelSlug(hostel: any) {
  if (hostel.public_slug) return hostel.public_slug;
  const slug = `${slugify(hostel.name || "hostel")}-${String(hostel.id).slice(0, 8)}`;
  await prisma.hostels.update({ where: { id: hostel.id }, data: { public_slug: slug } });
  return slug;
}

export class AdmissionsService {
  async getPublicHostel(slug: string) {
    const cacheKey = redisKeys.admissions.publicHostel(slug);
    return getOrSetJson(cacheKey, 180, async () => {
      const hostel = await prisma.hostels.findFirst({
        where: { public_slug: slug, is_active: true },
        include: {
          rooms: {
            where: { is_active: true },
            include: {
              floor_ref: { select: { name: true } },
              room_reservations: { where: { status: "ACTIVE", reserved_until: { gt: new Date() } }, select: { id: true } },
              room_allocations: {
                where: { is_active: true, end_date: null },
                include: {
                  tenant: {
                    select: {
                      college_name: true,
                      course: true,
                      year_of_study: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ floor: "asc" }, { room_no: "asc" }],
          },
        },
      });
      if (!hostel || !hostel.admissions_enabled) throw ApiError.notFound("This admissions link is not active");

      const rooms = hostel.rooms || [];
      const safeRooms = rooms.map(publicRoom);
      const currentStartingPrice = safeRooms
        .map((room: any) => room.pricing.monthly_rent)
        .filter((value: number) => value > 0)
        .sort((a: number, b: number) => a - b)[0] || null;

      const siblingHostels = await prisma.hostels.findMany({
        where: { owner_id: hostel.owner_id, is_active: true, id: { not: hostel.id } },
        include: {
          rooms: {
            where: { is_active: true },
            include: {
              room_allocations: { where: { is_active: true, end_date: null }, select: { id: true } },
              room_reservations: { where: { status: "ACTIVE", reserved_until: { gt: new Date() } }, select: { id: true } },
            },
          },
        },
        take: 6,
      });

      const otherHostels = await Promise.all(siblingHostels.map(async (h: any) => {
        const public_slug = await ensureHostelSlug(h);
        const vacancyCount = h.rooms.reduce((sum: number, room: any) => {
          const occupied = room.room_allocations?.length || 0;
          const reserved = room.room_reservations?.length || 0;
          return sum + Math.max(0, Number(room.capacity || 0) - occupied - reserved);
        }, 0);
        const startingPrice = h.rooms
          .map((room: any) => Number(room.base_rent || 0))
          .filter((value: number) => value > 0)
          .sort((a: number, b: number) => a - b)[0] || null;
        return {
          id: h.id,
          public_slug,
          name: h.name,
          vacancy_count: vacancyCount,
          starting_price: startingPrice,
          distance: null,
        };
      }));

      return {
        hostel: {
          id: hostel.id,
          public_slug: hostel.public_slug,
          name: hostel.name,
          phone: hostel.phone,
          address: hostel.address,
          city: hostel.city,
          state: hostel.state,
          logo_url: hostel.logo_url,
          photos: asArray(hostel.admission_photos),
          starting_price: currentStartingPrice,
          readiness: readinessForHostel(hostel, rooms),
        },
        trust_sections: {
          safety: ["Owner-managed records", "Visitor-friendly admission flow", "Private student data protected"],
          food: ["Food details available from owner", "Ask about menu during visit"],
          rules: ["Hostel rules are shared before activation", "Parent questions can be recorded"],
          curfew: "Contact the hostel for current curfew timing",
          warden_contact: hostel.phone,
          nearby_colleges: [],
        },
        rooms: safeRooms,
        other_hostels: otherHostels,
      };
    }, [redisKeys.admissions.publicHostelTag(slug)]);
  }

  async createLead(slug: string, input: any, ip: string) {
    const trap = cleanString(input.website, 50);
    if (trap) throw ApiError.badRequest("Invalid submission");

    const studentPhone = normalizeIndianPhone(input.student_phone);
    if (!studentPhone) throw ApiError.validationError("Student phone is invalid");
    const parentPhone = normalizeIndianPhone(input.parent_phone) || null;

    const limit = await checkFixedWindowLimit({
      scope: "visit-submit",
      identifier: `${slug}:${studentPhone}:${ip}`,
      maxAttempts: 6,
      windowSeconds: 60 * 60,
    });
    if (!limit.allowed) throw new ApiError("Please wait before submitting again", 429, "TOO_MANY_REQUESTS", { retry_after_seconds: limit.retryAfterSeconds });

    const hostel = await prisma.hostels.findFirst({ where: { public_slug: slug, is_active: true } });
    if (!hostel || !hostel.admissions_enabled) throw ApiError.notFound("This admissions link is not active");

    const studentName = cleanString(input.student_name, 120);
    if (!studentName) throw ApiError.validationError("Student name is required");
    const studentEmail = cleanString(input.student_email, 180)?.toLowerCase() || null;
    const decisionMaker = ["STUDENT", "PARENT", "BOTH"].includes(input.decision_maker_type)
      ? input.decision_maker_type
      : parentPhone ? "BOTH" : "STUDENT";

    const existing = await prisma.visitorLead.findFirst({
      where: {
        hostel_id: hostel.id,
        student_phone: studentPhone,
        status: { in: ACTIVE_LEAD_STATUSES },
      },
      orderBy: { created_at: "desc" },
    });

    const lead = existing
      ? await prisma.visitorLead.update({
          where: { id: existing.id },
          data: {
            student_name: studentName,
            student_email: studentEmail || existing.student_email,
            parent_name: cleanString(input.parent_name, 120) || existing.parent_name,
            parent_phone: parentPhone || existing.parent_phone,
            decision_maker_type: decisionMaker,
            last_activity_at: new Date(),
            updated_at: new Date(),
          },
        })
      : await prisma.visitorLead.create({
          data: {
            hostel_id: hostel.id,
            owner_id: hostel.owner_id,
            student_name: studentName,
            student_phone: studentPhone,
            student_email: studentEmail,
            parent_name: cleanString(input.parent_name, 120),
            parent_phone: parentPhone,
            decision_maker_type: decisionMaker,
            source: cleanString(input.source, 20) || "QR",
          },
        });

    await this.recordActivity(lead.id, "VIEW_HOSTEL", { source: "lead_capture" });
    await invalidateTag(redisKeys.admissions.owner(hostel.owner_id));
    return this.getLeadForOwner(lead.id, hostel.owner_id);
  }

  async recordActivity(leadId: string, activityType: string, metadata: Record<string, unknown> = {}, hostelSlug?: string) {
    const score = ACTIVITY_SCORES[activityType] ?? 0;
    const lead = await prisma.visitorLead.findUnique({
      where: { id: leadId },
      include: hostelSlug ? { hostel: { select: { public_slug: true } } } : undefined,
    });
    if (!lead) throw ApiError.notFound("Lead not found");
    if (hostelSlug && (lead as any).hostel?.public_slug !== hostelSlug) {
      throw ApiError.forbidden("Lead does not belong to this admissions link");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.leadActivity.create({
        data: {
          lead_id: leadId,
          activity_type: activityType,
          metadata,
        },
      });
      await tx.visitorLead.update({
        where: { id: leadId },
        data: {
          lead_score: { increment: score },
          status: this.nextStatusForActivity(lead.status, activityType),
          last_activity_at: new Date(),
          updated_at: new Date(),
        },
      });
    });
    await invalidateTag(redisKeys.admissions.owner(lead.owner_id));
    return { ok: true, score_delta: score };
  }

  nextStatusForActivity(status: string, activityType: string) {
    if (["INVITED", "JOINED", "LOST"].includes(status)) return status;
    if (activityType === "REQUEST_JOIN") return "READY_TO_JOIN";
    if (activityType === "RESERVE_ROOM") return "READY_TO_JOIN";
    if (activityType === "MARK_INTEREST") return "INTERESTED";
    return status;
  }

  async listLeads(ownerId: string, query: any) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(5, Number(query.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = { owner_id: ownerId };
    if (query.hostelId) where.hostel_id = String(query.hostelId);
    if (query.status) where.status = String(query.status);
    if (query.search) {
      const search = String(query.search);
      where.OR = [
        { student_name: { contains: search, mode: "insensitive" } },
        { student_phone: { contains: search } },
        { parent_phone: { contains: search } },
        { student_email: { contains: search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.visitorLead.findMany({
        where,
        include: {
          hostel: { select: { id: true, name: true } },
          reservations: { where: { status: "ACTIVE" }, include: { room: { select: { id: true, room_no: true } } } },
          _count: { select: { activities: true, notes_list: true } },
        },
        orderBy: [{ lead_score: "desc" }, { last_activity_at: "desc" }],
        skip,
        take: limit,
      }),
      prisma.visitorLead.count({ where }),
    ]);

    return {
      items: items.map((lead: any) => this.shapeLead(lead)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getLeadForOwner(leadId: string, ownerId: string) {
    const lead = await prisma.visitorLead.findFirst({
      where: { id: leadId, owner_id: ownerId },
      include: {
        hostel: { select: { id: true, name: true } },
        activities: { orderBy: { created_at: "desc" }, take: 80 },
        notes_list: { orderBy: { created_at: "desc" }, take: 50 },
        reservations: { include: { room: { select: { id: true, room_no: true, room_type: true } } }, orderBy: { created_at: "desc" } },
      },
    });
    if (!lead) throw ApiError.notFound("Lead not found");
    return this.shapeLead(lead);
  }

  shapeLead(lead: any) {
    return {
      ...lead,
      lead_temperature: leadTemperature(Number(lead.lead_score || 0)),
    };
  }

  async updateStatus(leadId: string, ownerId: string, input: any) {
    if (!LEAD_STATUSES.includes(input.status)) throw ApiError.validationError("Invalid lead status");
    if (input.status === "LOST" && input.lost_reason && !LOST_REASONS.includes(input.lost_reason)) {
      throw ApiError.validationError("Invalid lost reason");
    }
    const lead = await prisma.visitorLead.findFirst({ where: { id: leadId, owner_id: ownerId } });
    if (!lead) throw ApiError.notFound("Lead not found");
    const updated = await prisma.visitorLead.update({
      where: { id: leadId },
      data: {
        status: input.status,
        lost_reason: input.status === "LOST" ? input.lost_reason || "OTHER" : null,
        lost_note: input.status === "LOST" ? cleanString(input.lost_note, 500) : null,
        parent_contacted_at: input.parent_contacted ? new Date() : lead.parent_contacted_at,
        parent_follow_up_required: Boolean(input.parent_follow_up_required),
        updated_at: new Date(),
      },
    });
    await invalidateTag(redisKeys.admissions.owner(ownerId));
    return this.shapeLead(updated);
  }

  async addNote(leadId: string, ownerId: string, note: string) {
    const lead = await prisma.visitorLead.findFirst({ where: { id: leadId, owner_id: ownerId } });
    if (!lead) throw ApiError.notFound("Lead not found");
    const cleanNote = cleanString(note, 1200);
    if (!cleanNote) throw ApiError.validationError("Note is required");
    const created = await prisma.leadNote.create({ data: { lead_id: leadId, owner_id: ownerId, note: cleanNote } });
    await prisma.visitorLead.update({ where: { id: leadId }, data: { last_activity_at: new Date(), updated_at: new Date() } });
    return created;
  }

  async reserveRoom(leadId: string, ownerId: string, input: any) {
    const lead = await prisma.visitorLead.findFirst({ where: { id: leadId, owner_id: ownerId } });
    if (!lead) throw ApiError.notFound("Lead not found");
    const roomId = String(input.room_id || "");
    const room = await prisma.rooms.findFirst({
      where: { id: roomId, hostel_id: lead.hostel_id, hostels: { owner_id: ownerId }, is_active: true },
      include: {
        room_allocations: { where: { is_active: true, end_date: null }, select: { id: true } },
        room_reservations: { where: { status: "ACTIVE", reserved_until: { gt: new Date() } }, select: { id: true, lead_id: true } },
      },
    });
    if (!room) throw ApiError.notFound("Room not found");
    if (room.room_reservations.some((r: any) => r.lead_id === lead.id)) throw ApiError.conflict("This lead already has an active reservation for this room");
    const activeByPhone = await prisma.roomReservation.count({
      where: {
        status: "ACTIVE",
        reserved_until: { gt: new Date() },
        lead: { student_phone: lead.student_phone },
      },
    });
    if (activeByPhone >= 2) throw ApiError.conflict("This phone number already has the maximum active reservations");
    const recentExpired = await prisma.roomReservation.findFirst({
      where: {
        status: "EXPIRED",
        created_at: { gte: new Date(Date.now() - RESERVATION_COOLDOWN_HOURS * 60 * 60 * 1000) },
        lead: { student_phone: lead.student_phone },
      },
    });
    if (recentExpired) throw ApiError.conflict("Please wait before creating another reservation for this phone number");
    const availability = Number(room.capacity || 0) - room.room_allocations.length - room.room_reservations.length;
    if (availability <= 0) throw ApiError.conflict("Room has no available beds to reserve");

    const hours = Math.min(72, Math.max(1, Number(input.duration_hours || 24)));
    const reservation = await prisma.roomReservation.create({
      data: {
        lead_id: lead.id,
        room_id: room.id,
        hostel_id: lead.hostel_id,
        reserved_until: new Date(Date.now() + hours * 60 * 60 * 1000),
        approved_by: ownerId,
      },
      include: { room: { select: { id: true, room_no: true, room_type: true } } },
    });
    await this.recordActivity(lead.id, "RESERVE_ROOM", { room_id: room.id, reservation_id: reservation.id });
    return reservation;
  }

  async cancelReservation(leadId: string, reservationId: string, ownerId: string) {
    const reservation = await prisma.roomReservation.findFirst({
      where: { id: reservationId, lead_id: leadId, lead: { owner_id: ownerId } },
    });
    if (!reservation) throw ApiError.notFound("Reservation not found");
    return prisma.roomReservation.update({
      where: { id: reservationId },
      data: { status: "CANCELLED", updated_at: new Date() },
    });
  }

  async expireReservations() {
    const result = await prisma.roomReservation.updateMany({
      where: { status: "ACTIVE", reserved_until: { lt: new Date() } },
      data: { status: "EXPIRED", updated_at: new Date() },
    });
    return { expired: result.count };
  }

  async convertToInvitation(leadId: string, ownerId: string, input: any) {
    const lead = await prisma.visitorLead.findFirst({ where: { id: leadId, owner_id: ownerId } });
    if (!lead) throw ApiError.notFound("Lead not found");
    if (lead.converted_tenant_id) throw ApiError.conflict("Lead is already connected to a tenant invitation");
    const email = cleanString(input.email || lead.student_email, 180)?.toLowerCase();
    if (!email) throw ApiError.validationError("Email is required before sending an invitation");
    const roomId = String(input.room_id || "");
    if (!roomId) throw ApiError.validationError("Room is required before sending an invitation");

    const result: any = await invitationService.inviteTenant({
      email,
      name: lead.student_name,
      phone: lead.student_phone,
      room_id: roomId,
      monthly_rent: input.monthly_rent,
      advance_amount: input.advance_amount,
      maintenance_amount: input.maintenance_amount,
      joining_date: input.joining_date,
      maintenance_type: input.maintenance_type,
    }, ownerId);

    const tenantId = result?.tenant_id || result?.tenant?.id || null;
    const updated = await prisma.visitorLead.update({
      where: { id: leadId },
      data: {
        status: "INVITED",
        student_email: email,
        converted_tenant_id: tenantId,
        converted_at: new Date(),
        updated_at: new Date(),
      },
    });
    if (tenantId) {
      await prisma.roomReservation.updateMany({
        where: { lead_id: leadId, status: "ACTIVE" },
        data: { status: "CONVERTED", converted_at: new Date(), updated_at: new Date() },
      });
    }
    await invalidateTag(redisKeys.admissions.owner(ownerId));
    return { invitation: result, lead: this.shapeLead(updated) };
  }

  async markJoinedForTenant(tenantId: string) {
    await prisma.visitorLead.updateMany({
      where: { converted_tenant_id: tenantId },
      data: { status: "JOINED", updated_at: new Date() },
    });
  }

  async analytics(ownerId: string, query: any) {
    const hostelId = query.hostelId ? String(query.hostelId) : "all";
    const key = redisKeys.admissions.analytics(ownerId, hostelId);
    return getOrSetJson(key, 120, async () => {
      const where: any = { owner_id: ownerId };
      if (query.hostelId) where.hostel_id = String(query.hostelId);
      const [
        visitors,
        viewedRooms,
        interested,
        reserved,
        invited,
        joined,
        lostReasons,
        viewedRoomRows,
        requestedRooms,
      ] = await Promise.all([
        prisma.visitorLead.count({ where }),
        prisma.leadActivity.groupBy({ by: ["lead_id"], where: { activity_type: "VIEW_ROOM", lead: where } }).then((rows: any[]) => rows.length),
        prisma.visitorLead.count({ where: { ...where, status: { in: ["INTERESTED", "FOLLOW_UP", "READY_TO_JOIN", "INVITED", "JOINED"] } } }),
        prisma.roomReservation.count({ where: { lead: where } }),
        prisma.visitorLead.count({ where: { ...where, status: { in: ["INVITED", "JOINED"] } } }),
        prisma.visitorLead.count({ where: { ...where, status: "JOINED" } }),
        prisma.visitorLead.groupBy({ by: ["lost_reason"], where: { ...where, status: "LOST" }, _count: true }),
        prisma.leadActivity.findMany({ where: { activity_type: "VIEW_ROOM", lead: where }, select: { metadata: true }, take: 500 }),
        prisma.roomReservation.groupBy({ by: ["room_id"], where: { lead: where }, _count: true, orderBy: { _count: { room_id: "desc" } }, take: 10 }),
      ]);
      const viewedCounts = new Map<string, number>();
      for (const row of viewedRoomRows as any[]) {
        const roomId = row.metadata?.room_id;
        if (roomId) viewedCounts.set(roomId, (viewedCounts.get(roomId) || 0) + 1);
      }
      return {
        funnel: { visitors, viewed_rooms: viewedRooms, interested, reserved, invited, joined },
        conversion_rate: visitors > 0 ? Math.round((joined / visitors) * 1000) / 10 : 0,
        lost_reasons: lostReasons.map((r: any) => ({ reason: r.lost_reason || "OTHER", count: r._count })),
        most_viewed_rooms: Array.from(viewedCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([room_id, count]) => ({ room_id, count })),
        most_requested_rooms: requestedRooms.map((row: any) => ({ room_id: row.room_id, count: row._count })),
      };
    }, [redisKeys.admissions.owner(ownerId)]);
  }
}

export const admissionsService = new AdmissionsService();
