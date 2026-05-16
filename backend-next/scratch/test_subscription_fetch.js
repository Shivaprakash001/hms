const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const sub = await prisma.owner_subscriptions.findFirst({
      include: {
        plans: {
          select: {
            id: true,
            tenant_limit: true,
            hostel_limit: true,
            automation: true,
            multi_hostel: true,
            analytics: true,
            profile_photo: true,
            is_custom: true,
          },
        },
      },
    });
    console.log("Subscription fetched successfully:", sub ? sub.id : "No subscription found");
    if (sub) {
      console.log("Plan info:", sub.plans);
    }
  } catch (err) {
    console.error("Subscription fetch failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
