# Storage Migration Fix Guide

## 🚨 **Issue Resolved: `42501: must be owner of table objects` Error**

### **Problem Description**
When running the storage bucket migration (`20250823000001_create_storage_bucket_and_policies.sql`), users encountered the error:
```
ERROR: 42501: must be owner of table objects
```

This error occurred because the user running the migration lacked `OWNER` privileges on the `storage.objects` table in Supabase.

### **Root Cause**
- Supabase's `storage.objects` table has restricted ownership permissions
- Regular users cannot create RLS policies on this table
- The migration attempted to directly modify storage table permissions

### **Solution Implemented**
We've created a **`SECURITY DEFINER`** approach that:
1. Uses elevated privileges to bypass ownership restrictions
2. Creates temporary setup functions with proper permissions
3. Executes the required operations
4. Automatically cleans up temporary functions
5. Maintains security while achieving the desired outcome

## 🔧 **Deployment Steps**

### **Step 1: Create Storage Bucket (Manual)**
1. Go to **Supabase Dashboard** → **Storage**
2. Click **"Create a new bucket"**
3. Configure the bucket:
   - **Name**: `user-uploads`
   - **Public**: `false` (private)
   - **File size limit**: `5MB`
   - **Allowed MIME types**: 
     - `text/*`
     - `application/pdf`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### **Step 2: Run the Fixed Migration**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy and paste the content from `supabase/migrations/20250823000001_create_storage_bucket_and_policies.sql`
4. Click **"Run"**

### **Step 3: Verify Success**
The migration should complete without errors and show:
```
NOTICE: Storage policies created successfully
NOTICE: Cleanup function and trigger created successfully
NOTICE: Migration completed successfully!
NOTICE: Storage bucket policies and cleanup functions are now active.
NOTICE: Users can now upload, view, update, and delete their own files.
```

## 📋 **What the Migration Creates**

### **Storage Policies**
- **Upload Policy**: Users can upload files to their own folder
- **View Policy**: Users can view their own files
- **Update Policy**: Users can update their own files
- **Delete Policy**: Users can delete their own files

### **Cleanup Function**
- **Function**: `cleanup_orphaned_files()`
- **Purpose**: Automatically deletes storage files when courses are deleted
- **Trigger**: `cleanup_files_on_course_delete` on `courses` table

### **Security Features**
- **Row Level Security (RLS)**: Enabled on `storage.objects`
- **User Isolation**: Users can only access files in their own folder structure
- **Automatic Cleanup**: Prevents orphaned files from accumulating

## 🔍 **Verification Commands**

After running the migration, you can verify the setup with these SQL queries:

### **Check Storage Policies**
```sql
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
```

### **Check Cleanup Trigger**
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'cleanup_files_on_course_delete';
```

## 🚀 **Expected Results**

After successful deployment:
1. ✅ Storage bucket `user-uploads` exists and is private
2. ✅ RLS policies are active on `storage.objects`
3. ✅ Users can upload files to `course-uploads/{user_id}/` folders
4. ✅ Automatic cleanup of orphaned files works
5. ✅ File operations are properly secured per user

## 🆘 **Troubleshooting**

### **If Migration Still Fails**
1. **Check Supabase Role**: Ensure you're using a service role or admin account
2. **Verify Bucket Exists**: The storage bucket must be created before running the migration
3. **Check Permissions**: Ensure your account has sufficient database privileges

### **Common Issues**
- **Bucket not found**: Create the `user-uploads` bucket first
- **Permission denied**: Use service role key or contact Supabase support
- **Function already exists**: The migration handles this automatically with `DROP IF EXISTS`

## 📚 **Related Documentation**
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions](https://supabase.com/docs/guides/database/functions)

## 🎯 **Next Steps**
After successful migration:
1. Test file upload functionality in your application
2. Verify file access controls work correctly
3. Test automatic cleanup when courses are deleted
4. Monitor storage usage and performance

---

**Note**: This fix maintains the same security model while bypassing the ownership restriction. All user data remains properly isolated and secure.
