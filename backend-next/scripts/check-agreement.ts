import { prisma } from "../lib/db";

async function main() {
  const agreementId = "3a016aea-93a2-4a67-9f31-7d60b8b450c6";
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
  });
  console.log("Agreement ID:", agreement?.id);
  console.log("Agreement Status:", agreement?.status);
  console.log("Agreement PDF URL:", agreement?.pdf_url);
}

main();
