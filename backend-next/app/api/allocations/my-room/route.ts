import { NextRequest } from "next/server";
import { GET as getRoom } from "@/app/api/students/me/room/route";

export const runtime = "nodejs";

/**
 * 🔗 ALIAS for /api/students/me/room
 * GET /api/allocations/my-room
 */
export async function GET(req: NextRequest) {
    return getRoom(req);
}
