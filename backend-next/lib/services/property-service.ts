import { prisma } from "../db";
import { planEnforcementService } from "./plan-enforcement-service";


export class PropertyService {
  async getOwnerProfile(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        hostels: {
          where: { is_active: true },
          take: 1
        }
      }
    });

    if (!profile) throw new Error("NOT_FOUND: Owner profile not found");

    const hostel = profile.hostels[0] || {};
    
    return {
      owner: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role
      },
      hostel: {
        name: hostel.name || null,
        phone: hostel.phone || null,
        address: hostel.address || null,
        city: hostel.city || null,
        state: hostel.state || null,
        pincode: hostel.pincode || null,
        upi_id: hostel.upi_id || null,
        gst_number: hostel.gst_number || null,
        logo_url: (hostel as any).logo_url || null, // Assuming added to schema
      },
      preferences: {
        currency: (hostel as any).currency || "INR",
        rent_cycle: (hostel as any).rent_cycle || "MONTHLY",
        receipt_prefix: (hostel as any).receipt_prefix || "HMS",
        timezone: (hostel as any).timezone || "Asia/Kolkata",
        auto_rent_day: (hostel as any).auto_rent_day || 1,
        phonepe_merchant_id: (hostel as any).phonepe_merchant_id || "",
        // Spread extended config from JSON blob
        ...((hostel as any).preferences_config || {}),
      }
    };
  }

  async updateOwnerProfile(userId: string, data: { name?: string; phone?: string }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

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
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: { hostels: { where: { is_active: true }, take: 1 } }
    });

    if (!profile) throw new Error("NOT_FOUND: Profile not found");

    const hostel = profile.hostels[0];

    const mapped: any = {};
    if (data.name ?? data.hostel_name) mapped.name = data.name ?? data.hostel_name;
    if (data.phone ?? data.hostel_phone) mapped.phone = data.phone ?? data.hostel_phone;
    if (data.address !== undefined) mapped.address = data.address;
    if (data.city !== undefined) mapped.city = data.city;
    if (data.state !== undefined) mapped.state = data.state;
    if (data.pincode !== undefined) mapped.pincode = data.pincode;
    if (data.upi_id !== undefined) mapped.upi_id = data.upi_id;
    if (data.gst_number !== undefined) mapped.gst_number = data.gst_number;

    if (hostel) {
      await prisma.hostel.update({
        where: { id: hostel.id },
        data: mapped,
      });
    } else {
      // Enforcement: creating a new hostel requires active subscription and available hostel slots
      await planEnforcementService.assertSubscriptionActive(userId);
      await planEnforcementService.assertHostelLimit(userId);
      await prisma.hostel.create({
        data: {
          owner_id: userId,
          name: mapped.name || "My Hostel",
          phone: mapped.phone || "",
          address: mapped.address || "",
          ...mapped,
        },
      });
    }

    return this.getOwnerProfile(userId);
  }

  async updatePreferences(userId: string, data: any) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: { hostels: { where: { is_active: true }, take: 1 } },
    });

    if (!profile) throw new Error("NOT_FOUND: Profile not found");
    const hostel = profile.hostels[0];
    if (!hostel) throw new Error("VALIDATION: Please complete Hostel Details before setting preferences");

    // ── Typed columns (backward compat) ──
    const typedColumns = ["currency", "rent_cycle", "receipt_prefix", "timezone", "auto_rent_day", "phonepe_merchant_id"];
    const updateData: any = {};
    for (const key of typedColumns) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }

    // ── Server-side validation ──
    if (updateData.auto_rent_day !== undefined) {
      const day = Number(updateData.auto_rent_day);
      if (isNaN(day) || day < 1 || day > 28) throw new Error("VALIDATION: Rent generation day must be 1–28");
      updateData.auto_rent_day = day;
    }

    // ── Extended config (JSON blob) ──
    const extendedKeys = [
      "due_day", "late_fee_type", "late_fee_amount", "late_fee_percentage",
      "late_fee_after_days", "max_late_fee", "grace_days", "late_fee_rules",
      "allow_partial_payments", "min_payment_amount",
      "reminder_email", "reminder_in_app", "reminder_whatsapp",
      "reminder_day_1", "reminder_day_5", "reminder_day_10",
      "late_fee_notification", "owner_daily_summary",
      "auto_generate_rent", "auto_apply_late_fees", "auto_send_reminders", "auto_deactivate_days",
      "auto_email_receipt", "receipt_format", "receipt_footer",
      "require_doc_approval", "allow_tenant_edits", "data_retention_months",
      "date_format", "time_format", "language",
    ];

    const existingConfig = (hostel as any).preferences_config || {};
    const newConfig = { ...existingConfig };
    let hasExtended = false;

    for (const key of extendedKeys) {
      if (data[key] !== undefined) {
        newConfig[key] = data[key];
        hasExtended = true;
      }
    }

    // Financial safety validations
    if (newConfig.late_fee_amount !== undefined && Number(newConfig.late_fee_amount) > 10000) {
      throw new Error("VALIDATION: Late fee amount cannot exceed 10,000");
    }
    if (newConfig.late_fee_percentage !== undefined && (Number(newConfig.late_fee_percentage) < 0 || Number(newConfig.late_fee_percentage) > 50)) {
      throw new Error("VALIDATION: Late fee percentage must be 0–50%");
    }
    if (newConfig.max_late_fee !== undefined && Number(newConfig.max_late_fee) > 50000) {
      throw new Error("VALIDATION: Maximum late fee cannot exceed 50,000");
    }
    if (newConfig.min_payment_amount !== undefined && Number(newConfig.min_payment_amount) < 0) {
      throw new Error("VALIDATION: Minimum payment must be positive");
    }

    // ── Late Fee Rules Engine validation ──
    if (newConfig.grace_days !== undefined) {
      const gd = Number(newConfig.grace_days);
      if (isNaN(gd) || gd < 0 || gd > 30) throw new Error("VALIDATION: Grace period must be 0–30 days");
      newConfig.grace_days = gd;
    }

    if (newConfig.late_fee_rules !== undefined) {
      if (!Array.isArray(newConfig.late_fee_rules)) {
        throw new Error("VALIDATION: late_fee_rules must be an array");
      }
      if (newConfig.late_fee_rules.length > 5) {
        throw new Error("VALIDATION: Maximum 5 late fee rules allowed");
      }
      const validTypes = ["flat", "per_day", "percentage"];
      for (const rule of newConfig.late_fee_rules) {
        if (!rule.id || typeof rule.id !== "string") {
          throw new Error("VALIDATION: Each rule must have a string 'id'");
        }
        if (!validTypes.includes(rule.type)) {
          throw new Error(`VALIDATION: Invalid rule type '${rule.type}'. Must be: ${validTypes.join(", ")}`);
        }
        if (rule.type === "percentage") {
          const pct = Number(rule.value);
          if (isNaN(pct) || pct < 0 || pct > 100) {
            throw new Error("VALIDATION: Rule percentage must be 0–100");
          }
        } else {
          const amt = Number(rule.amount);
          if (isNaN(amt) || amt < 0 || amt > 50000) {
            throw new Error("VALIDATION: Rule amount must be 0–50,000");
          }
        }
        const afterDays = Number(rule.after_days);
        if (isNaN(afterDays) || afterDays < 1 || afterDays > 60) {
          throw new Error("VALIDATION: Rule after_days must be 1–60");
        }
      }
    }

    if (hasExtended) {
      updateData.preferences_config = newConfig;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("VALIDATION: No valid preference fields to update");
    }

    await prisma.hostel.update({
      where: { id: hostel.id },
      data: updateData,
    });

    return this.getOwnerProfile(userId);
  }

  async getFloorsWithRooms(ownerId: string) {
    const rooms = await prisma.room.findMany({
      where: { hostel: { owner_id: ownerId }, is_active: true },
      include: {
        allocations: {
          where: { is_active: true, end_date: null },
          include: {
            tenant: {
              include: {
                profile: true,
                obligations: {
                  where: { status: { not: "WAIVED" } },
                  include: { payments: true }
                }
              }
            }
          }
        }
      },
      orderBy: { room_no: "asc" }
    });

    const floorsMap: Map<number, any> = new Map();

    rooms.forEach((room: any) => {
      const floorNum = room.floor ?? 0;
      if (!floorsMap.has(floorNum)) {
        floorsMap.set(floorNum, { id: `f${floorNum}`, number: floorNum, rooms: [] });
      }

      const tenants = room.allocations.map((a: any) => {
        const tenant = a.tenant;
        const profile = tenant.profile;
        const totalAmount = tenant.obligations.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
        const totalPaid = tenant.obligations.reduce((sum: number, o: any) => 
          sum + o.payments.reduce((pSum: number, p: any) => pSum + Number(p.amount_paid), 0), 0);
        const pendingDues = totalAmount - totalPaid;

        return {
          tenant_id: tenant.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          joined_date: a.start_date,
          rent: Number(tenant.monthly_rent),
          pending_dues: pendingDues,
          status: tenant.status
        };
      });

      floorsMap.get(floorNum).rooms.push({
        id: room.id,
        room_no: room.room_no,
        capacity: room.capacity,
        occupied: tenants.length,
        floor: floorNum,
        tenants,
        pending_dues: tenants.reduce((sum: number, t: any) => sum + t.pending_dues, 0)
      });
    });

    return Array.from(floorsMap.values()).sort((a, b) => a.number - b.number);
  }

  async getRoomOverview(roomId: string, ownerId: string) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, hostel: { owner_id: ownerId } },
      include: {
        allocations: {
          where: { is_active: true, end_date: null },
          include: {
            tenant: {
              include: {
                profile: true,
                obligations: {
                  where: { status: { not: "WAIVED" } },
                  include: { payments: true }
                }
              }
            }
          }
        }
      }
    });

    if (!room) throw new Error("NOT_FOUND: Room not found");

    const tenants = room.allocations.map((a: any) => {
      const tenant = a.tenant;
      const profile = tenant.profile;
      const totalAmount = tenant.obligations.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
      const totalPaid = tenant.obligations.reduce((sum: number, o: any) => 
        sum + o.payments.reduce((pSum: number, p: any) => pSum + Number(p.amount_paid), 0), 0);
      const pendingDues = totalAmount - totalPaid;

      // Extract last payment info
      const allPayments = tenant.obligations.flatMap((o: any) => o.payments);
      const lastPayment = allPayments.length > 0 
        ? allPayments.sort((p1: any, p2: any) => new Date(p2.payment_date).getTime() - new Date(p1.payment_date).getTime())[0]
        : null;

      let paymentStatus = "PENDING";
      if (pendingDues <= 0) paymentStatus = lastPayment ? "PAID" : "NO_HISTORY";
      else if (lastPayment) paymentStatus = "PARTIAL";

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
        obligations: tenant.obligations
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
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        hostel: { owner_id: ownerId }
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
      const duplicate = await prisma.room.findFirst({
        where: { hostel_id: room.hostel_id, room_no: data.room_no }
      });
      if (duplicate) throw new Error(`VALIDATION: Room ${data.room_no} already exists`);
    }

    const { capacity, floor, room_no, base_rent } = data;
    const updateData: any = {
      ...(capacity !== undefined && { capacity: Number(capacity) }),
      ...(floor !== undefined && { floor: Number(floor) }),
      ...(room_no !== undefined && { room_no }),
      ...(base_rent !== undefined && { base_rent: Number(base_rent) })
    };

    if (Object.keys(updateData).length === 0) return room;

    const logEntry = `Fields updated: ${Object.keys(updateData).join(", ")}`;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id: roomId },
        data: updateData
      });

      await tx.roomActivityLog.create({
        data: {
          room_id: roomId,
          owner_id: ownerId,
          action: "ROOM_EDITED",
          previous_value: JSON.stringify({ room_no: room.room_no, capacity: room.capacity, floor: room.floor, base_rent: room.base_rent }),
          new_value: JSON.stringify(updateData)
        }
      });

      return updated;
    });
  }

}

export const propertyService = new PropertyService();
