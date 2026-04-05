-- Migration 035: Add profile completion fields
-- Adds columns needed for the student profile completion flow

-- Add is_profile_completed flag (default false for new users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_profile_completed BOOLEAN DEFAULT FALSE;

-- Add student-specific profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college_roll_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aadhaar_image_url TEXT;

-- Add unique constraint on college_roll_number (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_college_roll_number
    ON profiles (college_roll_number)
    WHERE college_roll_number IS NOT NULL;

-- Mark all existing owner/admin profiles as complete (they don't need this flow)
UPDATE profiles SET is_profile_completed = TRUE WHERE role IN ('admin', 'owner', 'warden');

-- Mark existing active students as complete (they already have their details)
UPDATE profiles SET is_profile_completed = TRUE
WHERE role = 'student'
  AND id IN (SELECT profile_id FROM students WHERE status = 'ACTIVE');
