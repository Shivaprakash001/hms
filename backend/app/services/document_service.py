"""
Service layer for identification document management.

Handles CRUD operations for tenant identification documents,
including file upload/download via Supabase Storage.
"""

from typing import Optional, Dict, Any
from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.file_handler import upload_file, delete_file, get_signed_url

logger = get_logger(__name__)


def upload_document(
    tenant_id: str,
    doc_type: str,
    document_number: Optional[str],
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
    uploaded_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload an identification document for a tenant.

    Business Rules:
    1. Tenant (student) must exist
    2. Only one document per (tenant, doc_type) — upsert behavior
    3. File must be valid (size, type)
    4. Old file is deleted if replacing

    Args:
        tenant_id: Student ID
        doc_type: Document type (AADHAR, DRIVING_LICENSE, PASSPORT)
        document_number: Optional document ID number
        file_bytes: Raw file content
        filename: Original filename
        content_type: MIME type
        uploaded_by: User ID performing the upload
    """
    try:
        logger.info(f"Uploading document type={doc_type} for tenant={tenant_id}")

        # Verify tenant exists
        tenant_result = supabase.table("students") \
            .select("id, profile_id") \
            .eq("id", tenant_id) \
            .execute()

        if not tenant_result.data:
            return ServiceResponse.not_found("Student/Tenant")

        # Check for existing document of same type
        existing = supabase.table("identification_documents") \
            .select("id, document_image_url") \
            .eq("tenant_id", tenant_id) \
            .eq("doc_type", doc_type) \
            .execute()

        # Upload file to Supabase Storage
        upload_result = upload_file(file_bytes, tenant_id, doc_type, filename, content_type)

        if not upload_result.get("success"):
            return ServiceResponse.error(
                ErrorCode.VALIDATION_ERROR,
                "File upload failed",
                upload_result.get("error", "Unknown upload error")
            )

        file_path = upload_result["file_path"]

        if existing.data:
            # Update existing document record
            old_doc = existing.data[0]
            old_file_path = old_doc.get("document_image_url")

            # Delete old file from storage
            if old_file_path:
                delete_file(old_file_path)

            update_data = {
                "document_image_url": file_path,
                "verified": False,  # Reset verification on re-upload
                "verified_by": None,
                "verified_at": None,
                "updated_at": "now()",
            }
            if document_number is not None:
                update_data["document_number"] = document_number

            result = supabase.table("identification_documents") \
                .update(update_data) \
                .eq("id", old_doc["id"]) \
                .execute()

            if not result.data:
                return ServiceResponse.error(
                    ErrorCode.DB_QUERY_ERROR,
                    "Failed to update document record"
                )

            doc_data = result.data[0]
            logger.info(f"Document updated: {doc_data['id']}")
        else:
            # Create new document record
            insert_data = {
                "tenant_id": tenant_id,
                "doc_type": doc_type,
                "document_number": document_number,
                "document_image_url": file_path,
                "verified": False,
            }

            result = supabase.table("identification_documents") \
                .insert(insert_data) \
                .execute()

            if not result.data:
                # Cleanup uploaded file on DB failure
                delete_file(file_path)
                return ServiceResponse.error(
                    ErrorCode.DB_QUERY_ERROR,
                    "Failed to create document record"
                )

            doc_data = result.data[0]
            logger.info(f"Document created: {doc_data['id']}")

        # Generate signed URL for response
        signed_url = get_signed_url(file_path)
        doc_data["signed_url"] = signed_url

        return ServiceResponse.success(doc_data, "Document uploaded successfully")

    except Exception as e:
        logger.exception(f"Error uploading document for tenant {tenant_id}: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred", str(e))


def get_tenant_documents(
    tenant_id: str,
    requesting_user_id: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all identification documents for a tenant.

    Authorization:
    - Admin/Owner: Can view any tenant's documents
    - Student: Can only view own documents
    """
    try:
        logger.debug(f"Fetching documents for tenant: {tenant_id}")

        # Verify tenant exists and check authorization
        tenant_result = supabase.table("students") \
            .select("id, profile_id") \
            .eq("id", tenant_id) \
            .execute()

        if not tenant_result.data:
            return ServiceResponse.not_found("Student/Tenant")

        # Authorization for students
        if requesting_user_role == 'student':
            tenant_profile_id = str(tenant_result.data[0].get('profile_id'))
            if tenant_profile_id != str(requesting_user_id):
                return ServiceResponse.forbidden("You can only view your own documents")

        # Fetch documents
        result = supabase.table("identification_documents") \
            .select("*") \
            .eq("tenant_id", tenant_id) \
            .order("created_at", desc=True) \
            .execute()

        documents = result.data or []

        # Generate signed URLs for each document
        for doc in documents:
            file_path = doc.get("document_image_url")
            if file_path:
                doc["signed_url"] = get_signed_url(file_path)
            else:
                doc["signed_url"] = None

        return ServiceResponse.success(documents)

    except Exception as e:
        logger.exception(f"Error fetching documents for tenant {tenant_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch documents", str(e))


def delete_document(
    tenant_id: str,
    doc_id: str,
    deleted_by: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Delete a specific identification document.

    Authorization:
    - Admin/Owner: Can delete any document
    - Student: Cannot delete documents
    """
    try:
        if requesting_user_role == 'student':
            return ServiceResponse.forbidden("Students cannot delete identification documents")

        logger.info(f"Deleting document {doc_id} for tenant {tenant_id}")

        # Fetch document to get file path
        doc_result = supabase.table("identification_documents") \
            .select("*") \
            .eq("id", doc_id) \
            .eq("tenant_id", tenant_id) \
            .execute()

        if not doc_result.data:
            return ServiceResponse.not_found("Document")

        doc = doc_result.data[0]
        file_path = doc.get("document_image_url")

        # Delete from storage
        if file_path:
            delete_file(file_path)

        # Delete from database
        supabase.table("identification_documents") \
            .delete() \
            .eq("id", doc_id) \
            .execute()

        logger.info(f"Document deleted: {doc_id}")
        return ServiceResponse.success({"deleted": True}, "Document deleted successfully")

    except Exception as e:
        logger.exception(f"Error deleting document {doc_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to delete document", str(e))


def verify_document(
    doc_id: str,
    verified_by: str,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Mark a document as verified.

    Authorization:
    - Admin/Owner only
    """
    try:
        if requesting_user_role not in ('admin', 'owner'):
            return ServiceResponse.forbidden("Only admin/owner can verify documents")

        logger.info(f"Verifying document {doc_id} by {verified_by}")

        result = supabase.table("identification_documents") \
            .update({
                "verified": True,
                "verified_by": verified_by,
                "verified_at": "now()",
                "updated_at": "now()"
            }) \
            .eq("id", doc_id) \
            .execute()

        if not result.data:
            return ServiceResponse.not_found("Document")

        # Check if all documents for this tenant are verified
        tenant_id = result.data[0].get("tenant_id")
        all_docs = supabase.table("identification_documents") \
            .select("verified") \
            .eq("tenant_id", tenant_id) \
            .execute()

        all_verified = all(d.get("verified") for d in (all_docs.data or []))

        if all_verified and all_docs.data:
            supabase.table("students") \
                .update({"document_verified": True}) \
                .eq("id", tenant_id) \
                .execute()
            logger.info(f"All documents verified for tenant {tenant_id}")

        return ServiceResponse.success(result.data[0], "Document verified successfully")

    except Exception as e:
        logger.exception(f"Error verifying document {doc_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to verify document", str(e))
