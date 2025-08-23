-- Migration: Add File Metadata to Courses Table
-- Date: 2025-08-23
-- Purpose: Add file_url and file_size fields to support Supabase Storage integration

-- Add new columns to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.courses.file_url IS 'URL to uploaded file in Supabase Storage (for large documents)';
COMMENT ON COLUMN public.courses.file_size IS 'Size of uploaded file in bytes';

-- Create index on file_url for performance
CREATE INDEX IF NOT EXISTS idx_courses_file_url ON public.courses(file_url) WHERE file_url IS NOT NULL;

-- Create index on file_size for analytics and monitoring
CREATE INDEX IF NOT EXISTS idx_courses_file_size ON public.courses(file_size) WHERE file_size IS NOT NULL;

-- Update RLS policies to include new columns
-- Ensure users can only access their own file metadata
DROP POLICY IF EXISTS "Users can view own courses" ON public.courses;
CREATE POLICY "Users can view own courses" ON public.courses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own courses" ON public.courses;
CREATE POLICY "Users can insert own courses" ON public.courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own courses" ON public.courses;
CREATE POLICY "Users can update own courses" ON public.courses
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own courses" ON public.courses;
CREATE POLICY "Users can delete own courses" ON public.courses
  FOR DELETE USING (auth.uid() = user_id);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'courses' 
  AND column_name IN ('file_url', 'file_size')
ORDER BY column_name;

-- Show updated table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'courses'
ORDER BY ordinal_position;
