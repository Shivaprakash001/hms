import { prisma } from "../lib/db";

async function main() {
  const tenants = await prisma.tenants.findMany({
    include: {
      profiles: true,
      agreements: true,
      identification_documents: true
    }
  });

  console.log(`Found ${tenants.length} tenants:`);
  for (const t of tenants) {
    console.log(`- TenantID: ${t.id}, ProfileID: ${t.profile_id}, Name: ${t.profiles?.name || 'N/A'}, Agreements: ${t.agreements.length}, Ident Docs: ${t.identification_documents.length}`);
    for (const a of t.agreements) {
      console.log(`  * Agreement ID: ${a.id}, Status: ${a.status}, PDF: ${a.pdf_url}`);
    }
  }
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
