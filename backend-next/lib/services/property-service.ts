import { prisma } from "../db";


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

    const allowed = ["currency", "rent_cycle", "receipt_prefix", "timezone", "auto_rent_day", "phonepe_merchant_id"];
    const updateData: any = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
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
            student: {
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
      const floorNum = room.floor ?? this.extractFloor(room.room_no);
      if (!floorsMap.has(floorNum)) {
        floorsMap.set(floorNum, { id: `f${floorNum}`, number: floorNum, rooms: [] });
      }

      const tenants = room.allocations.map((a: any) => {
        const student = a.student;
        const profile = student.profile;
        const totalAmount = student.obligations.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
        const totalPaid = student.obligations.reduce((sum: number, o: any) => 
          sum + o.payments.reduce((pSum: number, p: any) => pSum + Number(p.amount_paid), 0), 0);
        const pendingDues = totalAmount - totalPaid;

        return {
          student_id: student.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          joined_date: a.start_date,
          rent: Number(student.monthly_rent),
          pending_dues: pendingDues,
          status: student.status
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
            student: {
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
      const student = a.student;
      const profile = student.profile;
      const totalAmount = student.obligations.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
      const totalPaid = student.obligations.reduce((sum: number, o: any) => 
        sum + o.payments.reduce((pSum: number, p: any) => pSum + Number(p.amount_paid), 0), 0);
      const pendingDues = totalAmount - totalPaid;

      // Extract last payment info
      const allPayments = student.obligations.flatMap((o: any) => o.payments);
      const lastPayment = allPayments.length > 0 
        ? allPayments.sort((p1: any, p2: any) => new Date(p2.payment_date).getTime() - new Date(p1.payment_date).getTime())[0]
        : null;

      let paymentStatus = "PENDING";
      if (pendingDues <= 0) paymentStatus = lastPayment ? "PAID" : "NO_HISTORY";
      else if (lastPayment) paymentStatus = "PARTIAL";

      return {
        student_id: student.id,
        profile_id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        joined_date: a.start_date,
        rent: Number(student.monthly_rent),
        payment_status: paymentStatus,
        last_payment: lastPayment ? lastPayment.payment_date : null,
        last_payment_amount: lastPayment ? Number(lastPayment.amount_paid) : 0,
        pending_dues: pendingDues,
        status: student.status,
        obligations: student.obligations
      };
    });

    const floorNum = room.floor ?? this.extractFloor(room.room_no);
    const capacity = room.capacity;
    const occupied = tenants.length;

    // Gather latest payments for the room
    const payments = tenants
      .filter((t: any) => t.last_payment)
      .map((t: any) => ({
        student_id: t.student_id,
        student_name: t.name,
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

  private extractFloor(roomNo: string): number {
    try {
      if (roomNo.length >= 3 && !isNaN(parseInt(roomNo.substring(0, roomNo.length - 2)))) {
        return parseInt(roomNo.substring(0, roomNo.length - 2));
      }
    } catch {}
    return 0;
  }
}

export const propertyService = new PropertyService();
