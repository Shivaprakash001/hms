import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { prisma } from "../lib/db";

async function main() {
  const profiles = await prisma.profile.findMany({
    select: {
      email: true,
      role: true,
      id: true,
      owner_id: true,
      is_profile_completed: true,
    }
  });
  console.log("Profiles list:");
  console.log(JSON.stringify(profiles, null, 2));
  process.exit(0);
}

main().catch(console.error);
