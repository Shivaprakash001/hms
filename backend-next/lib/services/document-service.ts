import { prisma } from "../db";
import { eventSystem } from "../events";

export class DocumentService {
  async getTenantDocuments(tenantId: string, requestingUser: { sub: string, role: string }) {
    const student = await prisma.student.findUnique({
      where: { id: tenantId },
      select: { profile_id: true }
    });

    if (!student) throw new Error("NOT_FOUND: Student record not found");

    if (requestingUser.role === "STUDENT" && student.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own documents");
    }

    const docs = await prisma.identificationDocument.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" }
    });

    return docs;
  }

  async verifyDocument(docId: string, verifiedBy: string) {
    const doc = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        is_verified: true,
      }
    });

    // Check if all docs for this tenant are verified
    const allDocs = await prisma.identificationDocument.findMany({
      where: { tenant_id: doc.tenant_id }
    });

    const allVerified = allDocs.length > 0 && allDocs.every(d => d.is_verified);

    if (allVerified) {
      await prisma.student.update({
        where: { id: doc.tenant_id },
        data: { document_verified: true }
      });
    }

    return doc;
  }

  // Placeholder for S3/Supabase storage upload logic
  async uploadDocument(tenantId: string, data: { docType: string, fileUrl: string, uploadedBy: string, ownerId: string }) {
    const doc = await prisma.identificationDocument.create({
      data: {
        tenant_id: tenantId,
        doc_type: data.docType,
        file_url: data.fileUrl,
        uploaded_by: data.uploadedBy,
        is_verified: false
      }
    });

    await eventSystem.trigger("document_uploaded", {
      doc_id: doc.id,
      student_id: tenantId,
      doc_type: data.docType,
      owner_id: data.ownerId
    });

    return doc;
  }
}

export const documentService = new DocumentService();
