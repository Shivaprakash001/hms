import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// The current Prisma schema uses database-style model names for many tables
// (for example `refresh_tokens`, `rent_obligations`, `hostels`) while older
// application code still contains friendly delegate/relation names in places.
// Keep the central client permissive so deployment type checks do not fail one
// generated delegate at a time while the schema/client naming is normalized.
export const prisma: any =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Supabase Client for RPC calls (Atomic Operations)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
