import { prisma } from "../db";
import { imagekit, IMAGEKIT_URL_ENDPOINT } from "../imagekit";
import { eventSystem } from "../events";

// ── Constants ──────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class DocumentService {
  private async resolveTenantIdFromProfile(profileId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
      select: { id: true },
    });
    return tenant?.id || null;
  }

  // ── Get Documents (with signed URLs) ──────────────────────
  async getTenantDocuments(
    tenantId: string,
    requestingUser: { sub: string; role: string }
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { profile_id: true, owner_id: true },
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (
      requestingUser.role === "TENANT" &&
      tenant.profile_id !== requestingUser.sub
    ) {
      throw new Error("FORBIDDEN: You can only view your own documents");
    }

    if (
      requestingUser.role === "OWNER" &&
      tenant.owner_id !== requestingUser.sub
    ) {
      throw new Error("FORBIDDEN: Access denied");
    }

    const docs = await prisma.identificationDocument.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
    });

    // Generate signed URLs for each document (5-minute expiry)
    return docs.map((doc) => ({
      ...doc,
      signed_url: imagekit.helper.buildSrc({
        src: doc.file_url,
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        signed: true,
        expiresIn: 300,
      }),
      // Thumbnail URL for dashboard previews
      thumbnail_url: imagekit.helper.buildSrc({
        src: doc.file_url,
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        signed: true,
        expiresIn: 300,
        transformationPosition: "query",
        transformation: [{ width: "400" }],
      }),
    }));
  }

  // ── Upload Document ───────────────────────────────────────
  async uploadDocument(
    tenantId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    docType: string,
    docNumber?: string
  ) {
    // ─ Validate file ─
    this.validateFile(fileBuffer, mimeType, fileName);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { owner_id: true },
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    // ─ Duplicate Aadhaar check ─
    if (docType === "AADHAAR" && docNumber) {
      const existing = await prisma.identificationDocument.findFirst({
        where: {
          doc_type: "AADHAAR",
          doc_number: docNumber,
          tenant_id: { not: tenantId },
        },
      });
      if (existing) {
        throw new Error(
          "VALIDATION: This Aadhaar number is already registered with another tenant"
        );
      }
    }

    // ─ Folder structure: tenant-documents/{ownerId}/{tenantId}/ ─
    const folder = `tenant-documents/${tenant.owner_id}/${tenantId}`;

    // Convert Buffer to base64 for the v7.x SDK upload API
    const base64File = fileBuffer.toString("base64");

    const upload = await imagekit.files.upload({
      file: base64File,
      fileName: fileName,
      folder: folder,
      useUniqueFileName: true,
      tags: [docType, tenantId],
    });

    const document = await prisma.identificationDocument.create({
      data: {
        tenant_id: tenantId,
        doc_type: docType,
        doc_number: docNumber,
        file_url: upload.url || "",
        file_id: upload.fileId || null,
        document_status: "PENDING",
        is_verified: false,
        uploaded_by: tenantId,
      },
    });

    await eventSystem.trigger("document_uploaded", {
      tenant_id: tenantId,
      owner_id: tenant.owner_id,
      doc_id: document.id,
      doc_type: docType,
    });

    return document;
  }

  // ── Verify / Approve Document ─────────────────────────────
  async verifyDocument(docId: string, ownerId: string, isVerified: boolean) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { tenant: true },
    });

    if (!doc) throw new Error("NOT_FOUND: Document not found");
    if (doc.tenant.owner_id !== ownerId)
      throw new Error("FORBIDDEN: Access denied");

    const newStatus = isVerified ? "APPROVED" : "PENDING";

    const updated = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        is_verified: isVerified,
        document_status: newStatus,
        rejection_reason: isVerified ? null : undefined, // clear reason on approval
      },
    });

    // Update tenant's overall verification status
    if (isVerified) {
      const allDocs = await prisma.identificationDocument.findMany({
        where: { tenant_id: doc.tenant_id },
      });
      const allVerified =
        allDocs.length > 0 && allDocs.every((d) => d.document_status === "APPROVED");
      if (allVerified) {
        await prisma.tenant.update({
          where: { id: doc.tenant_id },
          data: { document_verified: true },
        });
      }
    } else {
      await prisma.tenant.update({
        where: { id: doc.tenant_id },
        data: { document_verified: false },
      });
    }

    await eventSystem.trigger("document_verified", {
      doc_id: docId,
      tenant_id: doc.tenant_id,
      owner_id: ownerId,
      is_verified: isVerified,
      status: newStatus,
    });

    return updated;
  }

  // ── Reject Document ───────────────────────────────────────
  async rejectDocument(docId: string, ownerId: string, reason?: string) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { tenant: true },
    });

    if (!doc) throw new Error("NOT_FOUND: Document not found");
    if (doc.tenant.owner_id !== ownerId)
      throw new Error("FORBIDDEN: Access denied");

    const updated = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        is_verified: false,
        document_status: "REJECTED",
        rejection_reason: reason || "Rejected by owner",
      },
    });

    // Tenant's overall verification is now false
    await prisma.tenant.update({
      where: { id: doc.tenant_id },
      data: { document_verified: false },
    });

    await eventSystem.trigger("document_rejected", {
      doc_id: docId,
      tenant_id: doc.tenant_id,
      owner_id: ownerId,
      reason: reason || "Rejected by owner",
    });

    return updated;
  }

  // ── Delete Document (with ImageKit cleanup) ───────────────
  async deleteDocument(
    docId: string,
    requestingUser: { sub: string; role: string }
  ) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { tenant: true },
    });

    if (!doc) throw new Error("NOT_FOUND: Document not found");

    if (requestingUser.role === "TENANT") {
      const tenantId = await this.resolveTenantIdFromProfile(requestingUser.sub);
      if (!tenantId || doc.tenant_id !== tenantId) {
        throw new Error("FORBIDDEN: Access denied");
      }
    }

    if (
      requestingUser.role === "OWNER" &&
      doc.tenant.owner_id !== requestingUser.sub
    ) {
      throw new Error("FORBIDDEN: Access denied");
    }

    // Delete from ImageKit if file_id is stored
    if (doc.file_id) {
      try {
        await imagekit.files.delete(doc.file_id);
      } catch (err) {
        console.error(
          `[DocumentService] Failed to delete file from ImageKit (fileId: ${doc.file_id}):`,
          err
        );
        // Continue with DB deletion even if ImageKit fails
      }
    }

    await prisma.identificationDocument.delete({
      where: { id: docId },
    });

    await eventSystem.trigger("document_deleted", {
      doc_id: docId,
      tenant_id: doc.tenant_id,
      owner_id: doc.tenant.owner_id,
      doc_type: doc.doc_type,
    });

    return { success: true };
  }

  // ── Delete ALL documents for a tenant (cascade on removal) ─
  async deleteAllTenantDocuments(tenantId: string) {
    const docs = await prisma.identificationDocument.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, file_id: true },
    });

    // Delete from ImageKit in parallel
    const deletePromises = docs
      .filter((d) => d.file_id)
      .map((d) =>
        imagekit.files.delete(d.file_id!).catch((err: unknown) => {
          console.error(
            `[DocumentService] Failed to delete ImageKit file ${d.file_id}:`,
            err
          );
        })
      );

    await Promise.allSettled(deletePromises);

    // Delete all DB records
    await prisma.identificationDocument.deleteMany({
      where: { tenant_id: tenantId },
    });

    return { success: true, deletedCount: docs.length };
  }

  // ── File Validation ───────────────────────────────────────
  private validateFile(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ) {
    // Size check
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `VALIDATION: File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
      );
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(
        `VALIDATION: Invalid file type "${mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    // Extension check (defense in depth)
    const ext = fileName.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "pdf"];
    if (!ext || !allowedExtensions.includes(ext)) {
      throw new Error(
        `VALIDATION: Invalid file extension ".${ext}". Allowed: ${allowedExtensions.join(", ")}`
      );
    }
  }
}

export const documentService = new DocumentService();
