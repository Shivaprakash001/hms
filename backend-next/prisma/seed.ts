import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.createMany({
    data: [
      { id: "FREE",     name: "Free",     price_inr: 0,      tenant_limit: 15,  hostel_limit: 1,  automation: false, multi_hostel: false, analytics: false, profile_photo: false, document_verification: false, is_custom: false, overflow_enabled: false, overflow_price_per_tenant_paise: 0,    overflow_hard_cap: 0   },
      { id: "STARTER",  name: "Starter",  price_inr: 79900,  tenant_limit: 100, hostel_limit: 1,  automation: true,  multi_hostel: false, analytics: false, profile_photo: true,  document_verification: false, is_custom: false, overflow_enabled: true,  overflow_price_per_tenant_paise: 1000, overflow_hard_cap: 150 },
      { id: "GROWTH",   name: "Growth",   price_inr: 149900, tenant_limit: 300, hostel_limit: 2,  automation: true,  multi_hostel: true,  analytics: true,  profile_photo: true,  document_verification: true,  is_custom: false, overflow_enabled: true,  overflow_price_per_tenant_paise: 800,  overflow_hard_cap: 400 },
      { id: "BUSINESS", name: "Business", price_inr: 249900, tenant_limit: 0,   hostel_limit: 4,  automation: true,  multi_hostel: true,  analytics: true,  profile_photo: true,  document_verification: true,  is_custom: false, overflow_enabled: false, overflow_price_per_tenant_paise: 0,    overflow_hard_cap: 0   },
      { id: "SCALE",    name: "Scale",    price_inr: 0,      tenant_limit: 0,   hostel_limit: 0,  automation: true,  multi_hostel: true,  analytics: true,  profile_photo: true,  document_verification: true,  is_custom: true,  overflow_enabled: false, overflow_price_per_tenant_paise: 0,    overflow_hard_cap: 0   },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Plans seeded successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
