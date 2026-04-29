import { prisma, supabase } from "../db";
import { eventSystem } from "../events";

export class RoomAllocationService {

  // ✅ FIXED: Added missing method
  async getActiveAllocations(userId: string) {
    return await prisma.roomAllocation.findMany({
      where: {
        tenant: {
          owner_id: userId
        },
        is_active: true,
        end_date: null // active allocations
      },
      include: {
        room: true,
        tenant: true
      },
      orderBy: {
        start_date: "desc"
      }
    });
  }

  // ✅ Allocate Room (Prisma Transaction based)
  async allocateRoom(data: { tenantId: string; roomId: string; startDate: string; ownerId: string }) {
    const { tenantId, roomId, startDate, ownerId } = data;

    const allocationData = await prisma.$transaction(async (tx) => {
      // 1. Check if tenant already has an active allocation
      const existing = await tx.roomAllocation.findFirst({
        where: { tenant_id: tenantId, is_active: true, end_date: null }
      });
      
      if (existing) {
        throw new Error("VALIDATION_ERROR: Tenant is already allocated to a room and checking out is required first");
      }

      // 2. Check room capacity
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: {
          allocations: {
            where: { end_date: null }
          }
        }
      });
      
      if (!room) {
        throw new Error("VALIDATION_ERROR: Room not found");
      }
      if (room.allocations.length >= room.capacity) {
        throw new Error("VALIDATION_ERROR: Room is at maximum capacity");
      }

      // 3. Create allocation
      return await tx.roomAllocation.create({
        data: {
          tenant_id: tenantId,
          room_id: roomId,
          start_date: new Date(startDate)
        }
      });
    });

    // ✅ Trigger Events
    await eventSystem.trigger("tenant_allocated_room", {
      tenant_id: tenantId,
      room_id: roomId,
      allocation_id: allocationData.id,
      owner_id: ownerId
    });

    return allocationData;
  }

  // ✅ End Allocation
  async endAllocation(allocationId: string, endDate: string) {
    return await prisma.roomAllocation.update({
      where: { id: allocationId },
      data: { 
        end_date: new Date(endDate),
        is_active: false
      }
    });
  }

  // ✅ Shift Room
  async shiftRoom(tenantId: string, newRoomId: string, shiftDate: string, ownerId: string) {

    const shiftData = await prisma.$transaction(async (tx) => {
      // 1. Find active allocation
      const active = await tx.roomAllocation.findFirst({
        where: { tenant_id: tenantId, is_active: true, end_date: null },
        orderBy: { start_date: "desc" }
      });

      if (!active) {
        throw new Error("NOT_FOUND: No active allocation found for tenant");
      }

      // 2. End old allocation
      await tx.roomAllocation.update({
        where: { id: active.id },
        data: { 
          end_date: new Date(shiftDate),
          is_active: false
        }
      });

      // 3. Check new room capacity
      const room = await tx.room.findUnique({
        where: { id: newRoomId },
        include: {
          allocations: {
            where: { end_date: null }
          }
        }
      });
      
      if (!room) {
        throw new Error("VALIDATION_ERROR: Target room not found");
      }
      if (room.allocations.length >= room.capacity) {
        throw new Error("VALIDATION_ERROR: Target room is at maximum capacity");
      }

      // 4. Create new allocation
      return await tx.roomAllocation.create({
        data: {
          tenant_id: tenantId,
          room_id: newRoomId,
          start_date: new Date(shiftDate)
        }
      });
    });

    // ✅ Trigger Events
    await eventSystem.trigger("tenant_allocated_room", {
      tenant_id: tenantId,
      room_id: newRoomId,
      allocation_id: shiftData.id,
      owner_id: ownerId
    });

    return { success: true, new_allocation: shiftData };
  }
}

// ✅ Singleton export
export const roomAllocationService = new RoomAllocationService();