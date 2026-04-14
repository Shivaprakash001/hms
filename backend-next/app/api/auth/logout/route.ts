import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  response.cookies.set("hms_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
