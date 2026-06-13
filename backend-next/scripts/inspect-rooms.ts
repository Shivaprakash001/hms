import { prisma } from "../lib/db";

async function main() {
  const hostels = await prisma.hostels.findMany({
    include: {
      rooms: {
        include: {
          room_allocations: {
            where: { is_active: true, end_date: null, tenant: { status: "ACTIVE" } }
          },
          room_reservations: {
            where: { status: "ACTIVE", reserved_until: { gt: new Date() } }
          },
          tenant_invitation_reservations: {
            where: { status: "ACTIVE", expires_at: { gt: new Date() } }
          }
        }
      }
    }
  });

  console.log("=== Hostels and Rooms ===");
  for (const h of hostels) {
    console.log(`Hostel: ${h.name} (${h.public_slug})`);
    const rooms = h.rooms || [];
    console.log(`Total Rooms: ${rooms.length}`);
    
    // Group rooms by sharing type (room_type)
    const groups: Record<string, any> = {};
    for (const r of rooms) {
      const type = r.room_type || "Standard";
      if (!groups[type]) {
        groups[type] = {
          count: 0,
          capacity: 0,
          occupied: 0,
          reserved: 0,
          available: 0,
          prices: new Set<number>()
        };
      }
      const occupied = r.room_allocations.length;
      const reserved = r.room_reservations.length + r.tenant_invitation_reservations.length;
      const available = Math.max(0, r.capacity - occupied - reserved);

      groups[type].count++;
      groups[type].capacity += r.capacity;
      groups[type].occupied += occupied;
      groups[type].reserved += reserved;
      groups[type].available += available;
      if (r.base_rent) {
        groups[type].prices.add(r.base_rent);
      }
    }

    for (const [type, data] of Object.entries(groups)) {
      console.log(`  - Type: ${type}`);
      console.log(`    Rooms Count: ${data.count}`);
      console.log(`    Beds Capacity: ${data.capacity}`);
      console.log(`    Occupied Beds: ${data.occupied}`);
      console.log(`    Reserved Beds: ${data.reserved}`);
      console.log(`    Available Beds: ${data.available}`);
      console.log(`    Rents: ${Array.from(data.prices).join(", ")}`);
    }
  }
}

main().catch(console.error);
