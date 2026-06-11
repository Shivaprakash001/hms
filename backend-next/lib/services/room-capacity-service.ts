import { prisma } from "../db";

type DbClient = typeof prisma | any;

export type RoomCapacitySnapshot = {
  room: any;
  room_id: string;
  capacity: number;
  occupied: number;
  reserved: number;
  used: number;
  available: number;
  state: "vacant" | "reserved" | "partial" | "full";
};

export class RoomCapacityService {
  async getRoomCapacitySnapshot(
    roomId: string,
    options: { tx?: DbClient; ownerId?: string } = {},
  ): Promise<RoomCapacitySnapshot> {
    const db = options.tx || prisma;
    const room = await db.rooms.findUnique({
      where: {
        id: roomId,
      },
      include: { hostels: true },
    });

    if (!room || !room.hostels || !room.is_active) {
      throw new Error("NOT_FOUND: Room not found");
    }
    if (options.ownerId && room.hostels.owner_id !== options.ownerId) {
      throw new Error("FORBIDDEN: Room belongs to a different owner");
    }

    const [occupied, reservedReservations, activeInvitations] = await Promise.all([
      db.roomAllocation.count({
        where: {
          room_id: roomId,
          is_active: true,
          end_date: null,
          tenant: { status: "ACTIVE" },
        },
      }),
      db.tenant_invitation_reservations.count({
        where: {
          room_id: roomId,
          status: "ACTIVE",
          expires_at: { gt: new Date() },
        },
      }),
      db.tenant_invitations.count({
        where: {
          room_id: roomId,
          status: { in: ["PENDING", "SENT"] },
          expires_at: { gt: new Date() },
        },
      }),
    ]);

    const reserved = Math.max(reservedReservations, activeInvitations);
    return this.toSnapshot(room, occupied, reserved);
  }

  async getHostelCapacityMap(
    hostelId: string,
    options: { ownerId?: string; tx?: DbClient } = {},
  ): Promise<Map<string, RoomCapacitySnapshot>> {
    const db = options.tx || prisma;
    const rooms = await db.rooms.findMany({
      where: {
        hostel_id: hostelId,
        is_active: true,
        ...(options.ownerId ? { hostels: { owner_id: options.ownerId } } : {}),
      },
      include: {
        hostels: true,
        _count: {
          select: {
            room_allocations: {
              where: {
                is_active: true,
                end_date: null,
                tenant: { status: "ACTIVE" },
              },
            },
            tenant_invitation_reservations: {
              where: {
                status: "ACTIVE",
                expires_at: { gt: new Date() },
              },
            },
            tenant_invitations: {
              where: {
                status: { in: ["PENDING", "SENT"] },
                expires_at: { gt: new Date() },
              },
            },
          },
        },
      },
    });

    return new Map(
      rooms.map((room: any) => [
        room.id,
        this.toSnapshot(
          room,
          Number(room._count?.room_allocations || 0),
          Math.max(
            Number(room._count?.tenant_invitation_reservations || 0),
            Number(room._count?.tenant_invitations || 0)
          ),
        ),
      ]),
    );
  }

  private toSnapshot(room: any, occupied: number, reserved: number): RoomCapacitySnapshot {
    const capacity = Number(room.capacity || 0);
    const used = occupied + reserved;
    const available = Math.max(0, capacity - used);
    const state = used >= capacity ? "full" : occupied > 0 ? "partial" : reserved > 0 ? "reserved" : "vacant";

    return {
      room,
      room_id: room.id,
      capacity,
      occupied,
      reserved,
      used,
      available,
      state,
    };
  }
}

export const roomCapacityService = new RoomCapacityService();
