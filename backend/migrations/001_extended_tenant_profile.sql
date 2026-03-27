-- ============================================
-- Epic 1: Extended Tenant Profile & Document Management
-- Database Migration Script
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add extended columns to students table
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_url VARCHAR,
  ADD COLUMN IF NOT EXISTS phone_1 VARCHAR,
  ADD COLUMN IF NOT EXISTS phone_2 VARCHAR,
  ADD COLUMN IF NOT EXISTS phone_3 VARCHAR,
  ADD COLUMN IF NOT EXISTS personal_email VARCHAR,
  ADD COLUMN IF NOT EXISTS college_name VARCHAR,
  ADD COLUMN IF NOT EXISTS branch VARCHAR,
  ADD COLUMN IF NOT EXISTS office_name VARCHAR,
  ADD COLUMN IF NOT EXISTS office_location VARCHAR,
  ADD COLUMN IF NOT EXISTS job_role VARCHAR,
  ADD COLUMN IF NOT EXISTS permanent_address TEXT,
  ADD COLUMN IF NOT EXISTS temporary_address TEXT,
  ADD COLUMN IF NOT EXISTS document_verified BOOLEAN DEFAULT FALSE;

-- 2. Create identification_documents table
CREATE TABLE IF NOT EXISTS identification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES students(id) ON DELETE CASCADE,
    doc_type VARCHAR NOT NULL CHECK (doc_type IN ('AADHAR', 'DRIVING_LICENSE', 'PASSPORT')),
    document_number VARCHAR,
    document_image_url VARCHAR,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_tenant_type 
  ON identification_documents(tenant_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_tenant 
  ON identification_documents(tenant_id);

-- 4. Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name IN ('photo_url', 'phone_1', 'phone_2', 'phone_3', 
  'personal_email', 'college_name', 'branch', 'office_name',
  'office_location', 'job_role', 'permanent_address', 
  'temporary_address', 'document_verified')
ORDER BY column_name;

-- ============================================
-- ROLLBACK (only run if you need to undo)
-- ============================================
-- ALTER TABLE students
--   DROP COLUMN IF EXISTS photo_url,
--   DROP COLUMN IF EXISTS phone_1,
--   DROP COLUMN IF EXISTS phone_2,
--   DROP COLUMN IF EXISTS phone_3,
--   DROP COLUMN IF EXISTS personal_email,
--   DROP COLUMN IF EXISTS college_name,
--   DROP COLUMN IF EXISTS branch,
--   DROP COLUMN IF EXISTS office_name,
--   DROP COLUMN IF EXISTS office_location,
--   DROP COLUMN IF EXISTS job_role,
--   DROP COLUMN IF EXISTS permanent_address,
--   DROP COLUMN IF EXISTS temporary_address,
--   DROP COLUMN IF EXISTS document_verified;
-- 
-- DROP TABLE IF EXISTS identification_documents;
