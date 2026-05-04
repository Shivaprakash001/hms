import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.createMany({
    data: [
      { id: "FREE",     name: "Free",     price_inr: 0,      tenant_limit: 15,  hostel_limit: 1,  automation: false, multi_hostel: false, analytics: false, is_custom: false },
      { id: "STARTER",  name: "Starter",  price_inr: 79900,  tenant_limit: 100, hostel_limit: 1,  automation: true,  multi_hostel: false, analytics: false, is_custom: false },
      { id: "GROWTH",   name: "Growth",   price_inr: 149900, tenant_limit: 300, hostel_limit: 2,  automation: true,  multi_hostel: true,  analytics: true,  is_custom: false },
      { id: "BUSINESS", name: "Business", price_inr: 249900, tenant_limit: 0,   hostel_limit: 4,  automation: true,  multi_hostel: true,  analytics: true,  is_custom: false },
      { id: "SCALE",    name: "Scale",    price_inr: 0,      tenant_limit: 0,   hostel_limit: 0,  automation: true,  multi_hostel: true,  analytics: true,  is_custom: true  },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Plans seeded successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
