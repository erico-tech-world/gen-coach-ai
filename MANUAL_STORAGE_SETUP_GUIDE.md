# Manual Storage Setup Guide

## 🚨 **Why Manual Setup is Required**

The automatic migration approach failed because of ownership restrictions on the `storage.objects` table. Even with `SECURITY DEFINER` functions, we cannot modify this system table directly.

## 🔧 **Alternative Approach: Manual Dashboard Setup**

This guide will show you how to set up storage policies manually in the Supabase Dashboard, which bypasses the ownership restrictions entirely.

## 📋 **Step-by-Step Setup Instructions**

### **Step 1: Create Storage Bucket**

1. **Go to Supabase Dashboard** → **Storage**
2. **Click "Create a new bucket"**
3. **Configure the bucket:**
   - **Name**: `user-uploads`
   - **Public**: `false` (private - this is crucial for security)
   - **File size limit**: `5MB`
   - **Allowed MIME types**: 
     - `text/*`
     - `application/pdf`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### **Step 2: Run the Migration (Creates Helper Functions)**

1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Create a new query**
3. **Copy and paste** the content from `supabase/migrations/20250823000001_create_storage_bucket_and_policies.sql`
4. **Click "Run"**

This will create:
- `cleanup_orphaned_files()` function for automatic file cleanup
- `can_access_file()` function for file access validation
- `validate_file_upload()` function for upload validation
- Trigger for automatic cleanup when courses are deleted

### **Step 3: Create Storage Policies Manually**

After running the migration, go to **Storage** → **Policies** and create these policies:

#### **Policy 1: Users can upload files to their own folder**
- **Target roles**: `authenticated`
- **Policy name**: `Users can upload files to their own folder`
- **Using expression**: 
```sql
bucket_id = 'user-uploads' 
AND (storage.foldername(name))[1] = 'course-uploads'
AND (storage.foldername(name))[2] = auth.uid()::text
```

#### **Policy 2: Users can view their own files**
- **Target roles**: `authenticated`
- **Policy name**: `Users can view their own files`
- **Using expression**: 
```sql
bucket_id = 'user-uploads' 
AND (storage.foldername(name))[1] = 'course-uploads'
AND (storage.foldername(name))[2] = auth.uid()::text
```

#### **Policy 3: Users can update their own files**
- **Target roles**: `authenticated`
- **Policy name**: `Users can update their own files`
- **Using expression**: 
```sql
bucket_id = 'user-uploads' 
AND (storage.foldername(name))[1] = 'course-uploads'
AND (storage.foldername(name))[2] = auth.uid()::text
```

#### **Policy 4: Users can delete their own files**
- **Target roles**: `authenticated`
- **Policy name**: `Users can delete their own files`
- **Using expression**: 
```sql
bucket_id = 'user-uploads' 
AND (storage.foldername(name))[1] = 'course-uploads'
AND (storage.foldername(name))[2] = auth.uid()::text
```

### **Step 4: Enable Row Level Security**

1. **Go to Storage** → **Policies**
2. **Click "Enable RLS"** on the `user-uploads` bucket
3. **Verify all policies are active**

## 🔍 **Verification Steps**

### **Check Functions Created**
Run this SQL query to verify the helper functions were created:
```sql
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name IN ('cleanup_orphaned_files', 'validate_file_upload', 'can_access_file')
ORDER BY routine_name;
```

### **Check Trigger Created**
Run this SQL query to verify the cleanup trigger was created:
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'cleanup_files_on_course_delete';
```

### **Check Storage Policies**
Go to **Storage** → **Policies** and verify:
- RLS is enabled on `user-uploads` bucket
- All 4 policies are active
- Policy expressions are correct

## 🚀 **Expected Results**

After successful setup:
1. ✅ Storage bucket `user-uploads` exists and is private
2. ✅ Helper functions are created and functional
3. ✅ Cleanup trigger is active
4. ✅ RLS policies are active and secure
5. ✅ Users can upload files to `course-uploads/{user_id}/` folders
6. ✅ Automatic cleanup of orphaned files works
7. ✅ File operations are properly secured per user

## 🆘 **Troubleshooting**

### **If Migration Still Fails**
- **Error**: Function creation fails
  - **Solution**: Check if you have sufficient database privileges
  - **Alternative**: Create functions manually one by one

### **If Policies Don't Work**
- **Issue**: Users can't upload/view files
  - **Solution**: Verify RLS is enabled and policies are active
  - **Check**: Policy expressions match the folder structure

### **If Cleanup Doesn't Work**
- **Issue**: Orphaned files remain after course deletion
  - **Solution**: Check if the trigger was created successfully
  - **Verify**: Function has proper permissions

## 📚 **How This Approach Works**

1. **Migration creates helper functions** that don't modify system tables
2. **Manual policy creation** in Dashboard bypasses ownership restrictions
3. **Helper functions provide validation** and cleanup capabilities
4. **Automatic cleanup** works through database triggers, not direct storage access

## 🎯 **Benefits of This Approach**

- ✅ **No ownership restrictions** - works with any user account
- ✅ **Secure file access** - users can only access their own files
- ✅ **Automatic cleanup** - orphaned files are removed automatically
- ✅ **Flexible policies** - easy to modify in Dashboard
- ✅ **No system table access** - avoids permission issues entirely

---

**Note**: This manual approach gives you the same security and functionality as the automatic approach, but bypasses the ownership restrictions that were causing the migration to fail.
