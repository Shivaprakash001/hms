export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imagekit } from "@/lib/imagekit";
import { eventLog } from "@/lib/services/event-log-service";

const ALLOWED_TYPES = ["AADHAAR", "COLLEGE_ID", "WORK_ID", "PASSPORT", "PAN", "OTHER"] as const;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const tenant = await prisma.tenants.findUnique({
    where: { profile_id: session.sub },
    select: { id: true },
  });
  if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);

  const documents = await prisma.identificationDocument.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { created_at: "desc" },
  });

  return apiResponse({ documents });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: session.sub },
      select: { id: true, owner_id: true },
    });
    if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = String(formData.get("doc_type") ?? "").toUpperCase();
    const docNumber = formData.get("doc_number") ? String(formData.get("doc_number")) : null;

    if (!file) return apiError("file is required", "VALIDATION_ERROR", 400);
    if (!ALLOWED_TYPES.includes(docType as (typeof ALLOWED_TYPES)[number])) {
      return apiError("Invalid doc_type", "VALIDATION_ERROR", 400);
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return apiError("File must be JPG, PNG, WEBP, or PDF", "VALIDATION_ERROR", 400);
    }
    if (file.size > MAX_SIZE) {
      return apiError("File must be under 5MB", "VALIDATION_ERROR", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await imagekit.files.upload({
      file: buffer.toString("base64"),
      fileName: file.name || `${docType.toLowerCase()}.jpg`,
      folder: `owners/${tenant.owner_id}/tenants/${tenant.id}/documents/${docType}`,
      useUniqueFileName: true,
      tags: [docType, tenant.id],
    });

    const created = await prisma.$transaction(async (tx) => {
      await tx.identificationDocument.updateMany({
        where: { tenant_id: tenant.id, doc_type: docType, is_active: true },
        data: { is_active: false },
      });

      const document = await tx.identificationDocument.create({
        data: {
          tenant_id: tenant.id,
          doc_type: docType,
          doc_number: docNumber,
          file_url: upload.url,
          file_path: upload.filePath,
          file_id: upload.fileId,
          mime_type: file.type,
          file_size: file.size,
          document_status: "PENDING",
          is_verified: false,
          uploaded_by: session.sub,
        },
      });

      await tx.tenants.update({
        where: { id: tenant.id },
        data: { document_verified: false },
      });

      return document;
    });

    await eventLog.log("documents_uploaded", tenant.owner_id || null, {
      tenant_id: tenant.id,
      doc_type: docType,
      document_id: created.id,
    }, tenant.id);

    return apiResponse(created, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(msg || "Failed to upload document");
  }
}
