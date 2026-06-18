import { prisma } from "../lib/db";

async function main() {
  try {
    const ownerId = 'c39676a0-c867-4435-9660-a060b8bceab6';
    const profile = await prisma.profile.findUnique({
      where: { id: ownerId }
    });
    console.log("\n=== OWNER PROFILE ===");
    console.log({
      id: profile?.id,
      email: profile?.email,
      name: profile?.name,
      phone: profile?.phone,
      password_hash: profile?.password_hash,
      role: profile?.role,
      is_active: profile?.is_active
    });
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
