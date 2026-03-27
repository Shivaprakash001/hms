"""
Router for tenant document management endpoints.

Handles file upload, listing, deletion, and verification
of identification documents (Aadhar, Driving License, Passport).
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from typing import Optional, List
from app.schemas.document_schema import DocumentResponse, DocumentType
from app.services import document_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner
from app.utils.responses import ErrorCode
from app.utils.logger import get_logger

router = APIRouter(prefix="/tenants", tags=["Tenant Documents"])
logger = get_logger(__name__)


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)
        message = error.get("message", "An error occurred")

        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.VALIDATION_ERROR.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
        }

        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=result.get("error"))

    return result.get("data")


@router.post(
    "/{tenant_id}/documents",
    status_code=status.HTTP_201_CREATED,
    summary="Upload identification document",
    description="Upload a document (Aadhar, Driving License, or Passport) for a tenant. Max 5MB, accepts images and PDF."
)
async def upload_document(
    tenant_id: str,
    doc_type: DocumentType = Form(..., description="Type of document: AADHAR, DRIVING_LICENSE, or PASSPORT"),
    document_number: Optional[str] = Form(None, description="Document ID number"),
    file: UploadFile = File(..., description="Document image or PDF (max 5MB)"),
    user: UserContext = Depends(get_current_user)
):
    """
    Upload an identification document for a tenant.

    **File Requirements:**
    - Max size: 5MB
    - Allowed types: JPG, JPEG, PNG, WebP, PDF

    **Behavior:**
    - If a document of the same type already exists, it will be replaced
    - Verification status resets on re-upload

    **Authorization:**
    - Admin/Owner: ✅ Can upload for any tenant
    - Student: ✅ Can upload for own profile only
    """
    file_bytes = await file.read()
    result = document_service.upload_document(
        tenant_id=tenant_id,
        doc_type=doc_type.value,
        document_number=document_number,
        file_bytes=file_bytes,
        filename=file.filename or "document",
        content_type=file.content_type,
        uploaded_by=user.user_id
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get(
    "/{tenant_id}/documents",
    response_model=List[DocumentResponse],
    summary="Get tenant documents",
    description="Retrieve all identification documents for a tenant with signed download URLs"
)
def get_documents(
    tenant_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Get all identification documents for a tenant.

    **Response includes:**
    - Document metadata (type, number, verification status)
    - Time-limited signed URLs for downloading/viewing documents

    **Authorization:**
    - Admin/Owner: ✅ Can view any tenant's documents
    - Student: ✅ Can view own documents only
    """
    result = document_service.get_tenant_documents(
        tenant_id=tenant_id,
        requesting_user_id=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.delete(
    "/{tenant_id}/documents/{doc_id}",
    summary="Delete a document",
    description="Delete an identification document (Admin/Owner only)",
    dependencies=[Depends(require_admin_or_owner)]
)
def delete_document(
    tenant_id: str,
    doc_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Delete a specific identification document.

    **Side Effects:**
    - Removes file from Supabase Storage
    - Removes database record
    - May update tenant document_verified status

    **Authorization:**
    - Admin/Owner: ✅ Can delete
    - Student: ❌ Cannot delete
    """
    result = document_service.delete_document(
        tenant_id=tenant_id,
        doc_id=doc_id,
        deleted_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.patch(
    "/{tenant_id}/documents/{doc_id}/verify",
    summary="Verify a document",
    description="Mark a document as verified (Admin/Owner only)",
    dependencies=[Depends(require_admin_or_owner)]
)
def verify_document(
    tenant_id: str,
    doc_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Mark an identification document as verified.

    **Side Effects:**
    - Sets verified=True, records who verified and when
    - If ALL documents for this tenant are verified, sets student.document_verified=True

    **Authorization:**
    - Admin/Owner: ✅ Can verify
    - Student: ❌ Cannot verify
    """
    result = document_service.verify_document(
        doc_id=doc_id,
        verified_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)
