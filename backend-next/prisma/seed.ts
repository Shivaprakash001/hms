import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.createMany({
    data: [
      { id: "FREE",     name: "Free",     price_inr: 0,      tenant_limit: 10,  hostel_limit: 1,  automation: false, messaging: false, multi_hostel: false, analytics: false },
      { id: "STARTER",  name: "Starter",  price_inr: 49900,  tenant_limit: 25,  hostel_limit: 1,  automation: false, messaging: false, multi_hostel: false, analytics: false },
      { id: "GROWTH",   name: "Growth",   price_inr: 149900, tenant_limit: 100, hostel_limit: 3,  automation: true,  messaging: true,  multi_hostel: false, analytics: true  },
      { id: "BUSINESS", name: "Business", price_inr: 399900, tenant_limit: 500, hostel_limit: 10, automation: true,  messaging: true,  multi_hostel: true,  analytics: true  },
      { id: "SCALE",    name: "Scale",    price_inr: 999900, tenant_limit: 0,   hostel_limit: 0,  automation: true,  messaging: true,  multi_hostel: true,  analytics: true  },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Plans seeded successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
