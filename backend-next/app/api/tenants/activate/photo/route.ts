export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imagekit } from "@/lib/imagekit";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get("token") as string | null;
    const file = formData.get("file") as File | null;

    if (!token) return apiError("token is required", "VALIDATION_ERROR", 400);
    if (!file) return apiError("file is required", "VALIDATION_ERROR", 400);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return apiError("Photo must be JPEG, PNG, or WEBP", "VALIDATION_ERROR", 400);
    }
    if (file.size > 2 * 1024 * 1024) {
      return apiError("Photo must be under 2MB", "VALIDATION_ERROR", 400);
    }

    const profile = await prisma.profile.findFirst({
      where: {
        invitation_token: token,
        invitation_expires_at: { gte: new Date() },
      },
      include: {
        tenants: true,
      },
    });

    if (!profile || !profile.tenants) {
      return apiError("Invalid or expired activation link", "INVALID", 410);
    }

    const tenant = profile.tenants;

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await imagekit.files.upload({
      file: buffer.toString("base64"),
      fileName: file.name || "profile.jpg",
      folder: `owners/${tenant.owner_id}/tenants/${tenant.id}/documents/PROFILE_PHOTO`,
      useUniqueFileName: true,
      tags: ["PROFILE_PHOTO", tenant.id],
    });

    const updated = await prisma.tenants.update({
      where: { id: tenant.id },
      data: { photo_url: upload.url },
      select: { id: true, photo_url: true },
    });

    return apiResponse(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(msg || "Failed to upload photo during activation");
  }
}
