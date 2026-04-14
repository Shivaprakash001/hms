import { prisma } from "../db";
import { ServiceResponse } from "./index"; // Assuming index.ts has a helper or just use the pattern

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

  async updateHostel(userId: string, data: any) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: { hostels: { where: { is_active: true }, take: 1 } }
    });

    if (!profile) throw new Error("NOT_FOUND: Profile not found");

    const hostel = profile.hostels[0];

    if (hostel) {
      return prisma.hostel.update({
        where: { id: hostel.id },
        data: {
          name: data.name ?? data.hostel_name,
          phone: data.phone ?? data.hostel_phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          upi_id: data.upi_id,
          gst_number: data.gst_number,
          currency: data.currency,
          rent_cycle: data.rent_cycle,
          receipt_prefix: data.receipt_prefix,
          timezone: data.timezone,
          auto_rent_day: data.auto_rent_day,
          phonepe_merchant_id: data.phonepe_merchant_id,
        }
      });
    } else {
      return prisma.hostel.create({
        data: {
          owner_id: userId,
          name: data.name ?? data.hostel_name ?? "My Hostel",
          phone: data.phone ?? data.hostel_phone ?? "",
          address: data.address ?? "",
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          ...data
        }
      });
    }
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

    rooms.forEach(room => {
      const floorNum = room.floor ?? this.extractFloor(room.room_no);
      if (!floorsMap.has(floorNum)) {
        floorsMap.set(floorNum, { id: `f${floorNum}`, number: floorNum, rooms: [] });
      }

      const tenants = room.allocations.map(a => {
        const student = a.student;
        const profile = student.profile;
        const totalAmount = student.obligations.reduce((sum, o) => sum + Number(o.amount), 0);
        const totalPaid = student.obligations.reduce((sum, o) => 
          sum + o.payments.reduce((pSum, p) => pSum + Number(p.amount_paid), 0), 0);
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
        pending_dues: tenants.reduce((sum, t) => sum + t.pending_dues, 0)
      });
    });

    return Array.from(floorsMap.values()).sort((a, b) => a.number - b.number);
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
