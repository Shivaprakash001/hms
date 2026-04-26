import { prisma } from "../db";
import { imagekit, IMAGEKIT_URL_ENDPOINT } from "../imagekit";
import { eventSystem } from "../events";

export class DocumentService {
  async getTenantDocuments(tenantId: string, requestingUser: { sub: string, role: string }) {
    const student = await prisma.student.findUnique({
      where: { id: tenantId },
      select: { profile_id: true, owner_id: true }
    });

    if (!student) throw new Error("NOT_FOUND: Student record not found");

    if (requestingUser.role === "STUDENT" && student.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own documents");
    }

    if (requestingUser.role === "OWNER" && student.owner_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: Access denied");
    }

    const docs = await prisma.identificationDocument.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" }
    });

    // Generate signed URLs for each document (5-minute expiry)
    return docs.map(doc => ({
      ...doc,
      signed_url: imagekit.helper.buildSrc({
        src: doc.file_url,
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        signed: true,
        expiresIn: 300,
      })
    }));
  }

  async uploadDocument(
    studentId: string,
    fileBuffer: Buffer,
    fileName: string,
    docType: string,
    docNumber?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { owner_id: true },
    });

    if (!student) throw new Error("NOT_FOUND: Student not found");

    const folder = `tenant-documents/${student.owner_id}/${studentId}`;

    // Convert Buffer to base64 for the v7.x SDK upload API
    const base64File = fileBuffer.toString("base64");

    const upload = await imagekit.files.upload({
      file: base64File,
      fileName: fileName,
      folder: folder,
      useUniqueFileName: true,
      tags: [docType, studentId],
    });

    const document = await prisma.identificationDocument.create({
      data: {
        tenant_id: studentId,
        doc_type: docType,
        doc_number: docNumber,
        file_url: upload.url || "",
        uploaded_by: studentId,
      },
    });

    await eventSystem.trigger("document_uploaded", {
      student_id: studentId,
      owner_id: student.owner_id,
      doc_id: document.id,
      doc_type: docType,
    });

    return document;
  }

  async verifyDocument(docId: string, ownerId: string, isVerified: boolean) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { student: true },
    });

    if (!doc) throw new Error("NOT_FOUND: Document not found");
    if (doc.student.owner_id !== ownerId) throw new Error("FORBIDDEN: Access denied");

    const updated = await prisma.identificationDocument.update({
      where: { id: docId },
      data: { is_verified: isVerified },
    });

    // Update student's overall verification status
    if (isVerified) {
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
    } else {
      await prisma.student.update({
        where: { id: doc.tenant_id },
        data: { document_verified: false }
      });
    }

    await eventSystem.trigger("document_verified", {
      doc_id: docId,
      student_id: doc.tenant_id,
      owner_id: ownerId,
      is_verified: isVerified,
    });

    return updated;
  }

  async deleteDocument(docId: string, requestingUser: { sub: string; role: string }) {
    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { student: true },
    });

    if (!doc) throw new Error("NOT_FOUND: Document not found");

    if (requestingUser.role === "STUDENT" && doc.tenant_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: Access denied");
    }

    if (requestingUser.role === "OWNER" && doc.student.owner_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: Access denied");
    }
    
    await prisma.identificationDocument.delete({
      where: { id: docId },
    });

    return { success: true };
  }
}

export const documentService = new DocumentService();
