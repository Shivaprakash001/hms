export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imagekit } from "@/lib/imagekit";
import { eventLog } from "@/lib/services/event-log-service";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return apiError("No file uploaded", "VALIDATION", 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError("Invalid file type. Only PNG, JPG, WEBP allowed", "VALIDATION", 400);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError("File size exceeds 2MB limit", "VALIDATION", 400);
    }

    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: session.sub, is_active: true }
    });

    if (!hostel) {
      return apiError("Hostel not found", "NOT_FOUND", 404);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64File = buffer.toString("base64");

    const uploadResponse = await imagekit.files.upload({
      file: base64File,
      fileName: `hostel_${hostel.id}_logo_${Date.now()}`,
      folder: "/hostel_logos",
      tags: ["logo", hostel.id]
    });

    if (!uploadResponse?.url) {
      throw new Error("Provider failed to return URL");
    }

    // Update the logo URL in the database
    const updatedHostel = await prisma.hostel.update({
      where: { id: hostel.id },
      data: { logo_url: uploadResponse.url }
    });

    await eventLog.log("PREFERENCE_CHANGED", session.sub, {
      field: "logo_upload",
      url: uploadResponse.url
    });

    return apiResponse({ 
      success: true, 
      logo_url: updatedHostel.logo_url 
    });

  } catch (error: any) {
    console.error("[LOGO_UPLOAD_ERROR]:", error);
    return apiError(error.message || "Failed to upload logo");
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: session.sub, is_active: true }
    });

    if (!hostel) {
      return apiError("Hostel not found", "NOT_FOUND", 404);
    }

    const updatedHostel = await prisma.hostel.update({
      where: { id: hostel.id },
      data: { logo_url: null }
    });

    await eventLog.log("PREFERENCE_CHANGED", session.sub, {
      field: "logo_removed"
    });

    return apiResponse({ 
      success: true, 
      logo_url: null 
    });

  } catch (error: any) {
    console.error("[LOGO_DELETE_ERROR]:", error);
    return apiError(error.message || "Failed to remove logo");
  }
}
