"""
File handler utility for Supabase Storage.

Handles upload, download (signed URLs), and deletion of tenant documents
using Supabase Storage instead of AWS S3, keeping the infrastructure unified.
"""

import time
from typing import Optional, Tuple
from app.db import supabase
from app.utils.logger import get_logger

logger = get_logger(__name__)

BUCKET_NAME = "tenant-documents"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "pdf", "webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "application/pdf"
}


def validate_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[bool, str]:
    """
    Validate file size and type.

    Returns:
        (is_valid, error_message)
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum limit of {MAX_FILE_SIZE // (1024 * 1024)}MB"

    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '.{ext}' is not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"

    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        return False, f"Content type '{content_type}' is not allowed"

    return True, ""


def get_file_path(tenant_id: str, doc_type: str, file_ext: str) -> str:
    """
    Generate a unique file path for storage.
    Format: {tenant_id}/{doc_type}_{timestamp}.{ext}
    """
    timestamp = int(time.time())
    return f"{tenant_id}/{doc_type}_{timestamp}.{file_ext}"


def upload_file(
    file_bytes: bytes,
    tenant_id: str,
    doc_type: str,
    filename: str,
    content_type: Optional[str] = None
) -> dict:
    """
    Upload a file to Supabase Storage.

    Args:
        file_bytes: Raw file bytes
        tenant_id: The tenant's student ID
        doc_type: Document type (AADHAR, DRIVING_LICENSE, PASSPORT)
        filename: Original filename
        content_type: MIME type of the file

    Returns:
        dict with 'success', 'file_path', 'public_url' or 'error'
    """
    try:
        # Validate
        is_valid, error_msg = validate_file(file_bytes, filename, content_type)
        if not is_valid:
            return {"success": False, "error": error_msg}

        file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin'
        file_path = get_file_path(tenant_id, doc_type, file_ext)

        # Determine content type
        ct = content_type or "application/octet-stream"

        logger.info(f"Uploading file: {file_path} ({len(file_bytes)} bytes)")

        # Upload to Supabase Storage
        result = supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": ct, "upsert": "true"}
        )

        logger.info(f"File uploaded successfully: {file_path}")

        return {
            "success": True,
            "file_path": file_path,
        }

    except Exception as e:
        logger.exception(f"Error uploading file: {e}")
        return {"success": False, "error": str(e)}


def delete_file(file_path: str) -> dict:
    """
    Delete a file from Supabase Storage.

    Args:
        file_path: Path of the file in the storage bucket

    Returns:
        dict with 'success' or 'error'
    """
    try:
        if not file_path:
            return {"success": True}  # Nothing to delete

        logger.info(f"Deleting file: {file_path}")
        supabase.storage.from_(BUCKET_NAME).remove([file_path])
        logger.info(f"File deleted successfully: {file_path}")
        return {"success": True}

    except Exception as e:
        logger.exception(f"Error deleting file: {e}")
        return {"success": False, "error": str(e)}


def get_signed_url(file_path: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a time-limited signed URL for downloading a file.

    Args:
        file_path: Path of the file in the storage bucket
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Signed URL string or None if error
    """
    try:
        if not file_path:
            return None

        result = supabase.storage.from_(BUCKET_NAME).create_signed_url(
            path=file_path,
            expires_in=expires_in
        )

        if result and "signedURL" in result:
            return result["signedURL"]

        # Some versions return it differently
        if isinstance(result, dict) and "signedUrl" in result:
            return result["signedUrl"]

        logger.warning(f"Unexpected signed URL response: {result}")
        return None

    except Exception as e:
        logger.exception(f"Error generating signed URL for {file_path}: {e}")
        return None
