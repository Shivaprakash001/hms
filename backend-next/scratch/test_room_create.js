const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const hostel = await prisma.hostels.findFirst();
    if (!hostel) {
      console.log("No hostel found to test with");
      return;
    }
    console.log("Testing room creation in hostel:", hostel.id);
    
    const room = await prisma.rooms.create({
      data: {
        hostel_id: hostel.id,
        room_no: "TEST-" + Date.now(),
        capacity: 2,
        floor: 1,
        room_type: "SINGLE",
        base_rent: 5000,
      },
    });
    console.log("Room created successfully:", room.id);
  } catch (err) {
    console.error("Room creation failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
