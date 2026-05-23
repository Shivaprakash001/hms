import { prisma } from "../db";
import { financialService } from "@/src/services/payments/financial-service";
import crypto from "crypto";


export class PropertyService {
  async getOwnerProfile(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        hostels: {
          where: { is_active: true },
          orderBy: { created_at: "asc" },
        }
      }
    });

    if (!profile) throw new Error("NOT_FOUND: Owner profile not found");
    
    const [onlyHostel] = profile.hostels;
    const singleHostel = profile.hostels.length === 1 ? onlyHostel : null;

    return {
      owner: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        emergency_contact: profile.emergency_contact,
      },
      hostels: profile.hostels.map((hostel: any) => ({
        id: hostel.id,
        name: hostel.name,
        phone: hostel.phone,
        address: hostel.address,
        city: hostel.city,
        state: hostel.state,
        pincode: hostel.pincode,
        upi_id: hostel.upi_id,
        gst_number: hostel.gst_number,
        logo_url: hostel.logo_url,
      })),
      // Compatibility shape only for single-hostel bootstrap screens. Multi-hostel
      // settings must fetch /api/hostels/:id/preferences explicitly.
      hostel: singleHostel ? {
        id: singleHostel.id,
        name: singleHostel.name || null,
        phone: singleHostel.phone || null,
        address: singleHostel.address || null,
        city: singleHostel.city || null,
        state: singleHostel.state || null,
        pincode: singleHostel.pincode || null,
        upi_id: singleHostel.upi_id || null,
        gst_number: singleHostel.gst_number || null,
        logo_url: (singleHostel as any).logo_url || null,
      } : null,
      preferences: {},
    };
  }

  async updateOwnerProfile(userId: string, data: {
    name?: string;
    phone?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    emergency_contact?: string | null;
  }) {
    const updateData: any = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (name.length < 2) throw new Error("VALIDATION: Name must be at least 2 characters");
      updateData.name = name;
    }
    if (data.phone !== undefined) {
      const phone = String(data.phone).trim();
      if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
        throw new Error("VALIDATION: Phone must be 10 to 15 digits");
      }
      updateData.phone = phone || null;
    }
    if (data.address !== undefined) updateData.address = cleanNullable(data.address);
    if (data.city !== undefined) updateData.city = cleanNullable(data.city);
    if (data.state !== undefined) updateData.state = cleanNullable(data.state);
    if (data.pincode !== undefined) {
      const pincode = cleanNullable(data.pincode);
      if (pincode && !/^[0-9]{4,10}$/.test(pincode)) {
        throw new Error("VALIDATION: Pincode must be numeric");
      }
      updateData.pincode = pincode;
    }
    if (data.emergency_contact !== undefined) {
      const emergencyContact = cleanNullable(data.emergency_contact);
      if (emergencyContact && !/^\+?[0-9]{10,15}$/.test(emergencyContact)) {
        throw new Error("VALIDATION: Emergency contact must be 10 to 15 digits");
      }
      updateData.emergency_contact = emergencyContact;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("VALIDATION: No valid fields to update");
    }

    await prisma.profile.update({
      where: { id: userId },
      data: updateData,
    });

    return this.getOwnerProfile(userId);
  }

  async updateHostel(userId: string, data: any) {
    const profile = await prisma.profile.findUnique({ where: { id: userId } });

    if (!profile) throw new Error("NOT_FOUND: Profile not found");

    const mapped: any = {};
    if (data.name ?? data.hostel_name) mapped.name = data.name ?? data.hostel_name;
    if (data.phone ?? data.hostel_phone) mapped.phone = data.phone ?? data.hostel_phone;
    if (data.address !== undefined) mapped.address = data.address;
    if (data.city !== undefined) mapped.city = data.city;
    if (data.state !== undefined) mapped.state = data.state;
    if (data.pincode !== undefined) mapped.pincode = data.pincode;
    if (data.upi_id !== undefined) mapped.upi_id = data.upi_id;
    if (data.gst_number !== undefined) mapped.gst_number = data.gst_number;

    const hostelId = data.hostel_id || data.hostelId;
    if (hostelId) {
      const updated = await prisma.hostels.updateMany({
        where: { id: hostelId, owner_id: userId, is_active: true },
        data: mapped,
      });
      if (updated.count !== 1) throw new Error("FORBIDDEN: Hostel is not owned by the authenticated owner");
    } else {
      const existingHostels = await prisma.hostels.findMany({
        where: { owner_id: userId, is_active: true },
        select: { id: true },
        orderBy: { created_at: "asc" },
        take: 2,
      });

      if (existingHostels.length === 1) {
        await prisma.hostels.update({
          where: { id: existingHostels[0].id },
          data: mapped,
        });
      } else if (existingHostels.length > 1) {
        throw new Error("VALIDATION: hostel_id is required for existing hostel updates");
      } else {
        await prisma.hostels.create({
          data: {
            owner_id: userId,
            name: mapped.name || "My Hostel",
            phone: mapped.phone || "",
            address: mapped.address || "",
            ...mapped,
          },
        });
      }
    }

    return this.getOwnerProfile(userId);
  }

  async updatePreferences(userId: string, data: any) {
    const hostelId = data?.hostel_id || data?.hostelId;
    if (!hostelId) {
      throw new Error("VALIDATION: hostel_id is required for preference updates");
    }

    const { hostelPolicyService } = await import("./hostel-policy-service");
    const policyPatch = data?.policy && typeof data.policy === "object" ? data.policy : {};
    if (!data.policy) {
      // Compatibility adapter for old callers that still send flat preference keys
      // after providing explicit hostel_id. This avoids first-hostel fallback while
      // the UI migrates module-by-module to nested policy domains.
      policyPatch.billing = {
        ...(data.rent_cycle !== undefined && { rent_cycle: data.rent_cycle }),
        ...(data.auto_rent_day !== undefined && { auto_rent_day: data.auto_rent_day }),
        ...(data.due_day !== undefined && { due_day: data.due_day }),
        ...(data.grace_days !== undefined && { grace_days: data.grace_days }),
        ...((data.late_fee_rules !== undefined || data.max_late_fee !== undefined) && {
          late_fee: {
            ...(data.late_fee_rules !== undefined && { rules: data.late_fee_rules }),
            ...(data.max_late_fee !== undefined && { max_amount: data.max_late_fee }),
          },
        }),
        ...((data.billing_defaults !== undefined) && {
          deposit: { default_amount: data.billing_defaults.advance_deposit },
          maintenance: { type: data.billing_defaults.maintenance_type, amount: data.billing_defaults.maintenance_charge },
          invite_defaults: {
            auto_fill_room_rent: data.billing_defaults.auto_fill_room_rent,
            allow_override: data.billing_defaults.allow_override,
          },
        }),
        ...((data.allow_partial_payments !== undefined || data.min_payment_amount !== undefined) && {
          partial_payments: {
            ...(data.allow_partial_payments !== undefined && { enabled: data.allow_partial_payments }),
            ...(data.min_payment_amount !== undefined && { minimum_amount: data.min_payment_amount }),
          },
        }),
      };
      policyPatch.payments = {
        ...(data.upi_id !== undefined && { upi_id: data.upi_id }),
        ...(data.phonepe_merchant_id !== undefined && { phonepe_merchant_id: data.phonepe_merchant_id }),
      };
      policyPatch.reminders = {
        ...(data.auto_send_reminders !== undefined && { enabled: data.auto_send_reminders }),
        channels: {
          ...(data.reminder_email !== undefined && { email: data.reminder_email }),
          ...(data.reminder_in_app !== undefined && { in_app: data.reminder_in_app }),
          ...(data.reminder_whatsapp !== undefined && { whatsapp: data.reminder_whatsapp }),
        },
        ...((data.reminder_day_1 !== undefined || data.reminder_day_5 !== undefined || data.reminder_day_10 !== undefined) && {
          schedule: {
            after_due_days: [
              ...(data.reminder_day_1 !== false ? [1] : []),
              ...(data.reminder_day_5 !== false ? [5] : []),
              ...(data.reminder_day_10 !== false ? [10] : []),
            ],
          },
        }),
        ...(data.late_fee_notification !== undefined && { late_fee_notifications: data.late_fee_notification }),
        ...(data.owner_daily_summary !== undefined && { owner_daily_summary: data.owner_daily_summary }),
      };
      policyPatch.automation = {
        ...(data.auto_generate_rent !== undefined && { auto_generate_rent: data.auto_generate_rent }),
        ...(data.auto_apply_late_fees !== undefined && { auto_apply_late_fees: data.auto_apply_late_fees }),
        ...(data.auto_send_reminders !== undefined && { auto_send_reminders: data.auto_send_reminders }),
        ...(data.auto_deactivate_days !== undefined && { auto_deactivate_days: data.auto_deactivate_days }),
        ...(data.auto_email_receipt !== undefined && { auto_email_receipts: data.auto_email_receipt }),
      };
      policyPatch.receipts = {
        ...(data.receipt_prefix !== undefined && { prefix: data.receipt_prefix }),
        ...(data.receipt_format !== undefined && { format: data.receipt_format }),
        ...(data.auto_email_receipt !== undefined && { auto_email: data.auto_email_receipt }),
        ...(data.receipt_footer !== undefined && { footer: data.receipt_footer }),
      };

      policyPatch.tenant_rules = {
        ...(data.allow_tenant_edits !== undefined && { allow_profile_edits: data.allow_tenant_edits }),
        ...(data.require_profile_photo_onboarding !== undefined && { profile_photo_required: data.require_profile_photo_onboarding }),
      };
      policyPatch.operations = {
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.date_format !== undefined && { date_format: data.date_format }),
        ...(data.time_format !== undefined && { time_format: data.time_format }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.data_retention_months !== undefined && { data_retention_months: data.data_retention_months }),
      };
    }

    return hostelPolicyService.updateHostelPolicy(hostelId, userId, policyPatch, userId);
  }

  async getFloors(ownerId: string, hostelId: string) {
    const floors = await prisma.floors.findMany({
      where: { hostel_id: hostelId, hostel: { owner_id: ownerId } },
      include: {
        rooms: {
          where: { is_active: true },
          select: {
            id: true,
            room_allocations: { where: { is_active: true, end_date: null }, select: { id: true } },
          },
        },
      },
      orderBy: { sort_order: "asc" },
    });

    return floors.map((f: any) => ({
      id: f.id,
      hostel_id: f.hostel_id,
      name: f.name,
      sort_order: f.sort_order,
      room_count: f.rooms.length,
      occupied_count: f.rooms.reduce((s: number, r: any) => s + r.room_allocations.length, 0),
    }));
  }

  async createFloor(ownerId: string, hostelId: string, data: { name: string; sort_order?: number }) {
    const hostel = await prisma.hostels.findFirst({ where: { id: hostelId, owner_id: ownerId } });
    if (!hostel) throw new Error("NOT_FOUND: Hostel not found");

    return await prisma.floors.create({
      data: {
        hostel_id: hostelId,
        owner_id: ownerId,
        name: data.name.trim(),
        sort_order: data.sort_order ?? 0,
      },
    });
  }

  async updateFloor(floorId: string, ownerId: string, data: { name?: string; sort_order?: number }) {
    const floor = await prisma.floors.findFirst({
      where: { id: floorId, hostel: { owner_id: ownerId } },
    });
    if (!floor) throw new Error("NOT_FOUND: Floor not found");

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.sort_order !== undefined) updateData.sort_order = Number(data.sort_order);
    if (Object.keys(updateData).length === 0) return floor;

    return await prisma.floors.update({ where: { id: floorId }, data: updateData });
  }

  async deleteFloor(floorId: string, ownerId: string) {
    const floor = await prisma.floors.findFirst({
      where: { id: floorId, hostel: { owner_id: ownerId } },
      include: { rooms: { where: { is_active: true }, select: { id: true } } },
    });
    if (!floor) throw new Error("NOT_FOUND: Floor not found");
    if (floor.rooms.length > 0) throw new Error("VALIDATION: Cannot delete floor with active rooms");

    await prisma.floors.delete({ where: { id: floorId } });
  }

  async getFloorsWithRooms(ownerId: string, hostelId: string) {
    // Load named floors ordered by sort_order; fall back to a synthetic record for rooms with no floor_id.
    const [floors, rooms] = await Promise.all([
      prisma.floors.findMany({
        where: { hostel_id: hostelId, hostel: { owner_id: ownerId } },
        orderBy: { sort_order: "asc" },
      }),
      prisma.rooms.findMany({
        where: { hostels: { owner_id: ownerId }, is_active: true, hostel_id: hostelId },
        include: {
          room_allocations: {
            where: { is_active: true, end_date: null },
            include: {
              tenant: {
                include: {
                  profiles: true,
                  rent_obligations: {
                    where: { status: { in: ["PENDING", "PARTIAL"] } },
                    include: { payments: { select: { amount_paid: true, payment_date: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { room_no: "asc" },
      }),
    ]);

    // Build floor index by id; also a fallback bucket for rooms with no floor_id.
    const floorMap = new Map<string, any>();
    floors.forEach((f: any) => {
      floorMap.set(f.id, { id: f.id, name: f.name, sort_order: f.sort_order, rooms: [] });
    });
    const unassigned: any = { id: "__unassigned", name: "Unassigned", sort_order: 999, rooms: [] };

    rooms.forEach((room: any) => {
      const tenants = room.room_allocations.map((a: any) => {
        const tenant = a.tenant;
        const profile = tenant.profiles;
        const summary = financialService.getTenantPaymentSummary(tenant.id, tenant.rent_obligations || []);
        return {
          tenant_id: tenant.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          joined_date: a.start_date,
          rent: Number(tenant.monthly_rent),
          pending_dues: Number(summary.pending_amount || 0),
          status: tenant.status,
        };
      });

      const roomEntry = {
        id: room.id,
        room_no: room.room_no,
        capacity: room.capacity,
        base_rent: room.base_rent,
        wifi_name: room.wifi_name ?? null,
        notes: room.notes ?? null,
        occupied: tenants.length,
        floor_id: room.floor_id ?? null,
        tenants,
        pending_dues: tenants.reduce((s: number, t: any) => s + t.pending_dues, 0),
      };

      const bucket = room.floor_id ? floorMap.get(room.floor_id) : null;
      (bucket ?? unassigned).rooms.push(roomEntry);
    });

    const result = Array.from(floorMap.values());
    if (unassigned.rooms.length > 0) result.push(unassigned);
    return result;
  }

  async getRoomOverview(roomId: string, ownerId: string) {
    const room = await prisma.rooms.findFirst({
      where: { id: roomId, hostels: { owner_id: ownerId } },
      include: {
        room_allocations: {
          where: { is_active: true, end_date: null },
          include: {
            tenant: {
              include: {
                profiles: true,
                rent_obligations: {
                  where: { status: { in: ["PENDING", "PARTIAL"] } },
                  include: { payments: { select: { amount_paid: true, payment_date: true } } }
                }
              }
            }
          }
        }
      }
    });

    if (!room) throw new Error("NOT_FOUND: Room not found");

    const tenants = room.room_allocations.map((a: any) => {
      const tenant = a.tenant;
      const profile = tenant.profiles;
      const obligations = tenant.rent_obligations || [];
      const summary = financialService.getTenantPaymentSummary(tenant.id, obligations);
      const pendingDues = Number(summary.pending_amount || 0);

      // Extract last payment info
      const allPayments = obligations.flatMap((o: any) => o.payments);
      const lastPayment = allPayments.length > 0 
        ? allPayments.sort((p1: any, p2: any) => new Date(p2.payment_date).getTime() - new Date(p1.payment_date).getTime())[0]
        : null;

      const paymentStatus = pendingDues <= 0
        ? (lastPayment ? "PAID" : "NO_HISTORY")
        : (summary.total_paid > 0 ? "PARTIAL" : "PENDING");

      return {
        tenant_id: tenant.id,
        profile_id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        joined_date: a.start_date,
        rent: Number(tenant.monthly_rent),
        payment_status: paymentStatus,
        last_payment: lastPayment ? lastPayment.payment_date : null,
        last_payment_amount: lastPayment ? Number(lastPayment.amount_paid) : 0,
        pending_dues: pendingDues,
        status: tenant.status,
        obligations
      };
    });

    const floorNum = room.floor ?? 0;
    const capacity = room.capacity;
    const occupied = tenants.length;

    // Gather latest payments for the room
    const payments = tenants
      .filter((t: any) => t.last_payment)
      .map((t: any) => ({
        tenant_id: t.tenant_id,
        tenant_name: t.name,
        payment_date: t.last_payment,
        amount_paid: t.last_payment_amount
      }))
      .sort((p1: any, p2: any) => new Date(p2.payment_date).getTime() - new Date(p1.payment_date).getTime());

    return {
      room: {
        id: room.id,
        room_id: room.id,
        room_no: room.room_no,
        floor: floorNum,
        capacity: capacity,
        base_rent: room.base_rent,
        monthly_rent: room.base_rent,
        occupied: occupied,
        remaining_capacity: Math.max(capacity - occupied, 0),
        status: occupied === 0 ? "Vacant" : (occupied >= capacity ? "Full" : "Occupied")
      },
      tenants,
      payments,
      pending_dues: tenants.reduce((sum: number, t: any) => sum + t.pending_dues, 0)
    };
  }
  
  async updateRoom(roomId: string, data: any, ownerId: string) {
    const room = await prisma.rooms.findFirst({
      where: {
        id: roomId,
        hostels: { owner_id: ownerId }
      }
    });

    if (!room) throw new Error("NOT_FOUND: Room not found");

    const occupants = await prisma.roomAllocation.count({
      where: {
        room_id: roomId,
        is_active: true,
        end_date: null
      }
    });

    if (data.capacity !== undefined) {
      if (data.capacity < occupants) {
        throw new Error(`VALIDATION: Capacity (${data.capacity}) cannot be less than current occupants (${occupants})`);
      }
      if (data.capacity > 20) {
        throw new Error(`VALIDATION: Capacity cannot exceed 20`);
      }
    }

    if (data.room_no !== undefined && data.room_no !== room.room_no) {
      const duplicate = await prisma.rooms.findFirst({
        where: { hostel_id: room.hostel_id, room_no: data.room_no }
      });
      if (duplicate) throw new Error(`VALIDATION: Room ${data.room_no} already exists`);
    }

    const { capacity, floor, floor_id, room_no, base_rent, wifi_name, wifi_password, notes } = data;
    const updateData: any = {
      ...(capacity  !== undefined && { capacity:  Number(capacity) }),
      ...(floor     !== undefined && { floor:     Number(floor) }),
      ...(floor_id  !== undefined && { floor_id }),
      ...(room_no   !== undefined && { room_no }),
      ...(base_rent !== undefined && { base_rent: Number(base_rent) }),
      ...(wifi_name     !== undefined && { wifi_name:     wifi_name     ?? null }),
      ...(wifi_password !== undefined && { wifi_password: wifi_password ?? null }),
      ...(notes         !== undefined && { notes:         notes         ?? null }),
      updated_at: new Date(),
    };

    // Remove updated_at if nothing meaningful changed
    const meaningfulKeys = Object.keys(updateData).filter((k) => k !== "updated_at");
    if (meaningfulKeys.length === 0) return room;

    return await prisma.$transaction(async (tx: any) => {
      const updated = await tx.rooms.update({
        where: { id: roomId },
        data: updateData
      });

      await tx.room_activity_logs.create({
        data: {
          id: crypto.randomUUID(),
          room_id: roomId,
          owner_id: ownerId,
          action: "ROOM_EDITED",
          previous_value: JSON.stringify({ room_no: room.room_no, capacity: room.capacity, floor: room.floor, base_rent: room.base_rent }),
          new_value: JSON.stringify(Object.fromEntries(meaningfulKeys.map((k) => [k, updateData[k]])))
        }
      });

      return updated;
    });
  }

}

function cleanNullable(value: unknown) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

export const propertyService = new PropertyService();
