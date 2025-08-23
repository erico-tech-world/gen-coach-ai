# 🚀 **GEN-COACH Deployment Guide - Supabase Storage Integration**

## 📋 **Overview**

This guide covers the deployment of the enhanced GEN-COACH system with:
- ✅ Payload size validation and file size limits
- ✅ Supabase Storage integration for large files
- ✅ Enhanced Edge Function with improved error handling
- ✅ Database schema updates for file metadata

## 🔧 **Prerequisites**

- Supabase project with Edge Functions enabled
- Access to Supabase Dashboard
- OpenRouter API key configured
- Supabase service role key available

## 📦 **Step 1: Update Edge Function**

### **1.1 Navigate to Edge Functions**
1. Go to **Supabase Dashboard** → **Edge Functions**
2. Find the `generate-course` function
3. Click **Edit/Update**

### **1.2 Replace Function Code**
1. Copy the entire content from `supabase/functions/generate-course/index.ts`
2. Paste it into the Edge Function editor
3. Click **Deploy**

### **1.3 Verify Environment Variables**
Ensure these are set in **Settings** → **Edge Functions**:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
SUPABASE_URL=https://tgcmwjbfyoiawbaxlqdd.supabase.co
SERVICE_ROLE_KEY=your_service_role_key_here
```

## 🗄️ **Step 2: Create Storage Bucket**

### **2.1 Navigate to Storage**
1. Go to **Supabase Dashboard** → **Storage**
2. Click **Create a new bucket**

### **2.2 Configure Bucket**
- **Bucket name**: `user-uploads`
- **Public bucket**: ❌ **Unchecked** (private)
- **File size limit**: `5MB`
- **Allowed MIME types**: 
  - `text/*`
  - `application/pdf`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### **2.3 Create Bucket**
Click **Create bucket** to finalize

## 🗃️ **Step 3: Run Database Migrations**

### **3.1 Navigate to SQL Editor**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query

### **3.2 Run First Migration**
Copy and paste the content from `supabase/migrations/20250823000000_add_file_metadata_to_courses.sql`:
```sql
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
```

Click **Run** to execute

### **3.3 Run Second Migration**
Create another query and paste the content from `supabase/migrations/20250823000001_create_storage_bucket_and_policies.sql`:
```sql
-- Migration: Create Storage Bucket and RLS Policies
-- Date: 2025-08-23
-- Purpose: Set up Supabase Storage for user file uploads with proper RLS policies

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for users to upload their own files
CREATE POLICY "Users can upload files to their own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'course-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Create policy for users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'course-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Create policy for users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'course-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Create policy for users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'course-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Create a function to clean up orphaned files when courses are deleted
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete associated files from storage when a course is deleted
  IF OLD.file_url IS NOT NULL THEN
    -- Extract filename from URL and delete from storage
    -- This is a simplified approach - in production you might want more sophisticated cleanup
    DELETE FROM storage.objects 
    WHERE bucket_id = 'user-uploads' 
      AND name LIKE '%' || split_part(OLD.file_url, '/', -1);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call cleanup function
DROP TRIGGER IF EXISTS cleanup_files_on_course_delete ON public.courses;
CREATE TRIGGER cleanup_files_on_course_delete
  BEFORE DELETE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_files();

-- Verify the storage policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- Verify the trigger was created
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'cleanup_files_on_course_delete';
```

Click **Run** to execute

## 🧪 **Step 4: Testing & Verification**

### **4.1 Test Small File Upload (≤1MB)**
1. Create a new course with a small text file
2. Verify file is processed inline
3. Check course generation completes successfully

### **4.2 Test Large File Upload (1-5MB)**
1. Create a new course with a large file (2-3MB)
2. Verify file is uploaded to Supabase Storage
3. Check course generation uses file URL
4. Verify course appears in dashboard

### **4.3 Test File Size Limits**
1. Try to upload a file >5MB
2. Verify graceful error message
3. Verify upload is blocked

### **4.4 Test Payload Size Limits**
1. Try to send a very large prompt
2. Verify Edge Function returns 413 (Payload Too Large)
3. Verify user-friendly error message

### **4.5 Test Duplicate Prevention**
1. Try to generate the same course twice
2. Verify only one course is created
3. Check for appropriate error messages

## 📊 **Step 5: Monitoring & Verification**

### **5.1 Check Edge Function Logs**
1. Go to **Edge Functions** → **Logs**
2. Look for successful course generation logs
3. Verify no 500 errors

### **5.2 Check Storage Usage**
1. Go to **Storage** → **user-uploads** bucket
2. Verify files are being uploaded correctly
3. Check file organization in folders

### **5.3 Check Database**
1. Go to **Table Editor** → **courses**
2. Verify new columns `file_url` and `file_size` exist
3. Check that file metadata is being stored

## 🚨 **Troubleshooting**

### **Issue: Storage Upload Fails**
- Verify bucket name is exactly `user-uploads`
- Check RLS policies are applied correctly
- Ensure user is authenticated

### **Issue: Edge Function Still Returns 500**
- Check environment variables are set correctly
- Verify Edge Function code was deployed
- Check function logs for specific error messages

### **Issue: File Size Validation Not Working**
- Verify database migration was run successfully
- Check that new columns exist in courses table
- Ensure frontend code is updated

### **Issue: RLS Policies Blocking Access**
- Verify storage policies are created correctly
- Check that user authentication is working
- Ensure bucket permissions are set correctly

## ✅ **Success Criteria**

After deployment, you should have:
- ✅ File uploads working for files ≤5MB
- ✅ Small files (≤1MB) processed inline
- ✅ Large files (1-5MB) stored in Supabase Storage
- ✅ Course generation working without 500 errors
- ✅ Proper file size validation and error messages
- ✅ Duplicate course prevention working
- ✅ File cleanup when courses are deleted

## 📞 **Support**

If you encounter issues:
1. Check Edge Function logs for specific error messages
2. Verify all migrations were run successfully
3. Ensure environment variables are configured correctly
4. Check Supabase service status at https://status.supabase.com

---

**Last Updated**: August 23, 2025  
**Status**: Ready for Deployment  
**Priority**: High (Critical Fix + Enhancement)
