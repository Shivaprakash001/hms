import { prisma } from "../db";
import { imagekit, IMAGEKIT_URL_ENDPOINT } from "../imagekit";
import { eventSystem } from "../events";
import { getTenantOperationalContext } from "../hostel-context";
import { planEnforcementService } from "./plan-enforcement-service";

// ── Document type constants ─────────────────────────────────
// Stored as VARCHAR in DB; validated here at the application layer.
export const DOCUMENT_TYPES = [
  "PROFILE_PHOTO",
  "AADHAAR",
  "PAN",
  "COLLEGE_ID",
  "WORK_ID",
  "PASSPORT",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const KYC_TYPES: DocumentType[] = [
  "AADHAAR",
  "PAN",
  "COLLEGE_ID",
  "WORK_ID",
  "PASSPORT",
];

// ── File constraints ────────────────────────────────────────
const ALLOWED_DOC_MIME  = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_DOC_SIZE   = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB
const BLOCKED_EXTENSIONS = ["exe", "sh", "bat", "cmd", "js", "php", "py", "rb", "pl"];

// ── Magic-byte MIME detection ───────────────────────────────
function detectMime(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8)                             return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e)         return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46)         return "image/webp"; // RIFF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  return null;
}

// ── Normalized response shape ───────────────────────────────
export interface DocResponse {
  id: string;
  type: string;
  status: string;
  view_url: string | null;
  thumb_url: string | null;
  uploaded_at: Date;
  rejection_reason: string | null;
  is_active: boolean;
}

function normalizeDoc(doc: any, viewUrl: string | null, thumbUrl: string | null): DocResponse {
  return {
    id:               doc.id,
    type:             doc.doc_type,
    status:           doc.document_status,
    view_url:         viewUrl,
    thumb_url:        thumbUrl,
    uploaded_at:      doc.created_at,
    rejection_reason: doc.rejection_reason ?? null,
    is_active:        doc.is_active ?? true,
  };
}

// ── Signed URL helper ───────────────────────────────────────
function buildSignedUrl(
  doc: { file_url: string | null; file_path?: string | null },
  transformation?: Record<string, string>[]
): string | null {
  const src = doc.file_url;
  if (!src || src.startsWith("data:")) return null; // guard legacy base64
  try {
    return imagekit.helper.buildSrc({
      src,
      urlEndpoint:            IMAGEKIT_URL_ENDPOINT,
      signed:                 true,
      expiresIn:              300,
      ...(transformation
        ? { transformationPosition: "query", transformation }
        : {}),
    });
  } catch {
    return null;
  }
}

export class DocumentService {
  // ── Resolve tenant id from profile id ──────────────────────
  private async resolveTenantIdFromProfile(profileId: string) {
    const t = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
      select: { id: true },
    });
    return t?.id || null;
  }

  // ── Load tenant with owner isolation check ─────────────────
  private async loadTenant(
    tenantId: string,
    requestingUser: { sub: string; role: string }
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { profile_id: true, owner_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (requestingUser.role === "TENANT" && tenant.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only manage your own documents");
    }
    if (requestingUser.role === "OWNER" && tenant.owner_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: Access denied");
    }
    return tenant;
  }

  // ── File validation ─────────────────────────────────────────
  private validateFile(
    buf: Buffer,
    mimeType: string,
    fileName: string,
    allowedMime: string[],
    maxSize: number
  ) {
    if (buf.length > maxSize) {
      throw new Error(`VALIDATION: File too large. Max ${maxSize / (1024 * 1024)}MB`);
    }
    // Magic byte check (defense-in-depth: reject spoofed MIME)
    const detected = detectMime(buf);
    if (detected && !allowedMime.includes(detected)) {
      throw new Error(`VALIDATION: File content detected as "${detected}" which is not allowed`);
    }
    // MIME header check
    if (!allowedMime.includes(mimeType)) {
      throw new Error(`VALIDATION: MIME type "${mimeType}" not allowed. Accepted: ${allowedMime.join(", ")}`);
    }
    // Extension check
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new Error(`VALIDATION: Executable file extension ".${ext}" is not allowed`);
    }
    const allowedExts = ["jpg", "jpeg", "png", "webp", "pdf"];
    if (!allowedExts.includes(ext)) {
      throw new Error(`VALIDATION: Extension ".${ext}" not allowed. Accepted: ${allowedExts.join(", ")}`);
    }
  }

  // ── Sync tenant.document_verified from active KYC docs ─────
  private async syncVerificationFlag(tenantId: string) {
    const kyc = await prisma.identificationDocument.findMany({
      where: {
        tenant_id: tenantId,
        is_active:  true,
        doc_type:   { in: KYC_TYPES },
      },
      select: { document_status: true },
    });
    const allApproved = kyc.length > 0 && kyc.every(d => d.document_status === "APPROVED");
    await prisma.tenant.update({
      where: { id: tenantId },
      data:  { document_verified: allApproved },
    });
  }

  // ── Upload Profile Photo (STARTER+) ───────────────────────
  // Stored as tenant.photo_url — NOT a verification document.
  async uploadProfilePhoto(
    tenantId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    requestingUser: { sub: string; role: string }
  ): Promise<{ photo_url: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { owner_id: true, profile_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    if (requestingUser.role === "TENANT" && tenant.profile_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");
    if (requestingUser.role === "OWNER" && tenant.owner_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");

    const ownerId = tenant.owner_id;
    if (!ownerId) throw new Error("FORBIDDEN: Tenant has no owner");

    await planEnforcementService.assertDocumentUpload(ownerId, "PROFILE_PHOTO");
    this.validateFile(fileBuffer, mimeType, fileName, ALLOWED_PHOTO_MIME, MAX_PHOTO_SIZE);

    const upload = await imagekit.files.upload({
      file:              fileBuffer.toString("base64"),
      fileName,
      folder:            `owners/${ownerId}/tenants/${tenantId}/documents/PROFILE_PHOTO`,
      useUniqueFileName: true,
      tags:              ["PROFILE_PHOTO", tenantId],
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data:  { photo_url: upload.url },
    });

    const signed = buildSignedUrl({ file_url: upload.url ?? null }) ?? upload.url ?? "";
    return { photo_url: signed };
  }

  // ── Upload KYC Document (GROWTH+) ─────────────────────────
  async uploadDocument(
    tenantId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    docType: string,
    docNumber?: string,
    requestingUser?: { sub: string; role: string }
  ): Promise<DocResponse> {
    if (!KYC_TYPES.includes(docType as DocumentType)) {
      throw new Error(
        `VALIDATION: Invalid doc type "${docType}". Allowed: ${KYC_TYPES.join(", ")}`
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { owner_id: true, profile_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    if (requestingUser?.role === "TENANT" && tenant.profile_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");
    if (requestingUser?.role === "OWNER" && tenant.owner_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");

    const ownerId = tenant.owner_id;
    if (!ownerId) throw new Error("FORBIDDEN: Tenant has no owner");

    await planEnforcementService.assertDocumentUpload(ownerId, docType);
    this.validateFile(fileBuffer, mimeType, fileName, ALLOWED_DOC_MIME, MAX_DOC_SIZE);

    if (docType === "AADHAAR" && docNumber) {
      const conflict = await prisma.identificationDocument.findFirst({
        where: { doc_type: "AADHAAR", doc_number: docNumber, tenant_id: { not: tenantId }, is_active: true },
      });
      if (conflict)
        throw new Error("VALIDATION: This Aadhaar number is already registered with another tenant");
    }

    const upload = await imagekit.files.upload({
      file:              fileBuffer.toString("base64"),
      fileName,
      folder:            `owners/${ownerId}/tenants/${tenantId}/documents/${docType}`,
      useUniqueFileName: true,
      tags:              [docType, tenantId],
    });

    // Archive any previous active doc of this type
    await prisma.identificationDocument.updateMany({
      where: { tenant_id: tenantId, doc_type: docType, is_active: true },
      data:  { is_active: false },
    });

    const document = await prisma.identificationDocument.create({
      data: {
        tenant_id:       tenantId,
        doc_type:        docType,
        doc_number:      docNumber ?? null,
        file_url:        upload.url || "",
        file_path:       (upload as any).filePath ?? null,
        file_id:         upload.fileId ?? null,
        mime_type:       mimeType,
        file_size:       fileBuffer.length,
        document_status: "PENDING",
        is_verified:     false,
        is_active:       true,
        uploaded_by:     requestingUser?.sub ?? tenantId,
      },
    });

    await eventSystem.trigger("document_uploaded", {
      tenant_id: tenantId, owner_id: ownerId, doc_id: document.id, doc_type: docType,
    });

    return normalizeDoc(document, null, null);
  }

  // ── Get Documents (active only, signed URLs) ──────────────
  async getTenantDocuments(
    tenantId: string,
    requestingUser: { sub: string; role: string }
  ): Promise<{ docs: DocResponse[]; plan_gate: string | null }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { profile_id: true, owner_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");
    if (requestingUser.role === "TENANT" && tenant.profile_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: You can only view your own documents");
    if (requestingUser.role === "OWNER" && tenant.owner_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");

    // Plan gate check — signal to frontend if KYC feature is locked
    let plan_gate: string | null = null;
    if (tenant.owner_id) {
      try {
        await planEnforcementService.assertDocumentUpload(tenant.owner_id, "AADHAAR");
      } catch (err: any) {
        const msg: string = err?.message ?? "";
        if (msg.startsWith("PLAN_LIMIT")) {
          plan_gate = msg.split(": ")[1] ?? "DOCUMENT_VERIFICATION_NOT_ALLOWED";
        }
      }
    }

    const docs = await prisma.identificationDocument.findMany({
      where:   { tenant_id: tenantId, is_active: true },
      orderBy: { created_at: "desc" },
    });

    let requireApproval = false;
    if (requestingUser.role === "TENANT" && tenant.owner_id) {
      // Phase 2: resolve from tenant's hostel if available
      const tenantWithHostel = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { hostel_id: true },
      });
      const { prefs } = await getTenantOperationalContext(tenantId, tenant.owner_id, tenantWithHostel?.hostel_id);
      requireApproval = prefs.require_doc_approval === true;
    }

    return {
      plan_gate,
      docs: docs.map((doc) => {
        const accessible = !requireApproval || doc.document_status === "APPROVED";
        return normalizeDoc(
          doc,
          accessible ? buildSignedUrl(doc) : null,
          accessible ? buildSignedUrl(doc, [{ width: "400" }]) : null
        );
      }),
    };
  }

  // ── Verification badge ─────────────────────────────────────
  // Derives from active KYC docs — no mutable flag.
  async getVerificationBadge(tenantId: string): Promise<"VERIFIED" | "PENDING" | "REJECTED" | "NOT_STARTED"> {
    const docs = await prisma.identificationDocument.findMany({
      where:  { tenant_id: tenantId, is_active: true, doc_type: { in: KYC_TYPES } },
      select: { document_status: true },
    });
    if (docs.length === 0)                                       return "NOT_STARTED";
    if (docs.every((d) => d.document_status === "APPROVED"))    return "VERIFIED";
    if (docs.some((d)  => d.document_status === "REJECTED"))    return "REJECTED";
    return "PENDING";
  }

  // ── Approve Document ──────────────────────────────────────
  async approveDocument(docId: string, ownerId: string): Promise<DocResponse> {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId }, include: { tenant: true },
    });
    if (!doc) throw new Error("NOT_FOUND: Document not found");
    if (doc.tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Access denied");

    const updated = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        document_status:  "APPROVED",
        is_verified:      true,
        approved_by:      ownerId,
        approved_at:      new Date(),
        rejection_reason: null,
        rejected_by:      null,
        rejected_at:      null,
      },
    });

    await this.syncVerificationFlag(doc.tenant_id);

    await eventSystem.trigger("document_verified", {
      doc_id: docId, tenant_id: doc.tenant_id, owner_id: ownerId, status: "APPROVED",
    });

    return normalizeDoc(updated, buildSignedUrl(updated), null);
  }

  // ── Reject Document ───────────────────────────────────────
  async rejectDocument(docId: string, ownerId: string, reason?: string, ip?: string): Promise<DocResponse> {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId }, include: { tenant: true },
    });
    if (!doc) throw new Error("NOT_FOUND: Document not found");
    if (doc.tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Access denied");

    const updated = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        document_status:  "REJECTED",
        is_verified:      false,
        rejection_reason: reason || "Rejected by owner",
        rejected_by:      ownerId,
        rejected_at:      new Date(),
        reject_ip:        ip ?? null,
        approved_by:      null,
        approved_at:      null,
      },
    });

    await prisma.tenant.update({
      where: { id: doc.tenant_id }, data: { document_verified: false },
    });

    await eventSystem.trigger("document_rejected", {
      doc_id: docId, tenant_id: doc.tenant_id, owner_id: ownerId,
      reason: reason || "Rejected by owner",
    });

    return normalizeDoc(updated, null, null);
  }

  // ── verifyDocument (backward-compat alias) ─────────────────
  // isVerified=true → APPROVED, isVerified=false → REJECTED
  async verifyDocument(docId: string, ownerId: string, isVerified: boolean) {
    if (isVerified) return this.approveDocument(docId, ownerId);
    return this.rejectDocument(docId, ownerId);
  }

  // ── Delete Document ───────────────────────────────────────
  async deleteDocument(docId: string, requestingUser: { sub: string; role: string }) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId }, include: { tenant: true },
    });
    if (!doc) throw new Error("NOT_FOUND: Document not found");

    if (requestingUser.role === "TENANT") {
      const tenantId = await this.resolveTenantIdFromProfile(requestingUser.sub);
      if (!tenantId || doc.tenant_id !== tenantId) throw new Error("FORBIDDEN: Access denied");
    }
    if (requestingUser.role === "OWNER" && doc.tenant.owner_id !== requestingUser.sub)
      throw new Error("FORBIDDEN: Access denied");

    if (doc.file_id) {
      try { await imagekit.files.delete(doc.file_id); }
      catch (err) { console.error(`[DocumentService] ImageKit delete failed (${doc.file_id}):`, err); }
    }

    await prisma.identificationDocument.delete({ where: { id: docId } });

    await this.syncVerificationFlag(doc.tenant_id);

    await eventSystem.trigger("document_deleted", {
      doc_id: docId, tenant_id: doc.tenant_id, owner_id: doc.tenant.owner_id, doc_type: doc.doc_type,
    });

    return { success: true };
  }

  // ── Delete ALL docs for a tenant (used on tenant removal) ──
  async deleteAllTenantDocuments(tenantId: string) {
    const docs = await prisma.identificationDocument.findMany({
      where:  { tenant_id: tenantId },
      select: { id: true, file_id: true },
    });

    await Promise.allSettled(
      docs.filter((d) => d.file_id).map((d) =>
        imagekit.files.delete(d.file_id!).catch((err: unknown) =>
          console.error(`[DocumentService] ImageKit delete failed (${d.file_id}):`, err)
        )
      )
    );

    await prisma.identificationDocument.deleteMany({ where: { tenant_id: tenantId } });
    return { success: true, deletedCount: docs.length };
  }
}

export const documentService = new DocumentService();
