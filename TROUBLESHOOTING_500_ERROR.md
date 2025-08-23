# 🔧 Troubleshooting 500 Internal Server Error in generate-course Edge Function

## 🚨 **Issue Description**
After uploading a file and clicking "Generate Course", you're getting a 500 Internal Server Error from the Supabase Edge Function.

## 🔍 **Root Cause Analysis**

The 500 error is likely caused by one of these issues:

1. **Missing Environment Variables** in Supabase Edge Functions
2. **Database Connection Issues** during idempotency checking
3. **OpenRouter API Configuration Problems**
4. **Edge Function Code Errors**

## 🚀 **Immediate Fixes Applied**

I've already updated the Edge Function with:
- ✅ Better error handling and validation
- ✅ Robust idempotency checking
- ✅ Improved error logging
- ✅ Fallback behavior when database checks fail

## 📋 **Step-by-Step Resolution**

### **Step 1: Update the Edge Function**

1. **Navigate to Supabase Dashboard** → **Edge Functions**
2. **Find `generate-course` function**
3. **Click Edit/Update**
4. **Replace entire content** with the updated code from `supabase/functions/generate-course/index.ts`
5. **Click Deploy**

### **Step 2: Verify Environment Variables**

In **Supabase Dashboard** → **Settings** → **Edge Functions**, ensure these are set:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
SUPABASE_URL=https://tgcmwjbfyoiawbaxlqdd.supabase.co
SERVICE_ROLE_KEY=your_service_role_key_here
```

**⚠️ Critical**: The `SERVICE_ROLE_KEY` must be the **service role key**, not the anon key.

### **Step 3: Test the Edge Function**

Use the debug script I created:

```bash
node debug_edge_function.js
```

This will test the Edge Function directly and show you the exact error.

## 🔍 **Debugging Steps**

### **Check Edge Function Logs**

1. **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Look for the `generate-course` function logs
3. Check for specific error messages

**Expected Logs**:
```
Generate course function started
Received request body length: [number]
Parsed request - prompt length: [number]
Request ID: [id]
Performing idempotency check for request ID: [id]
Idempotency check passed - no duplicates found
Calling OpenRouter API...
Parsing AI response...
Saving course to database...
Course saved successfully with ID: [uuid], Request ID: [id]
Course generation completed successfully
```

**Error Logs to Look For**:
```
Missing OPENROUTER_API_KEY environment variable
Missing Supabase environment variables
Error during idempotency check: [details]
Database operation failed: [details]
```

### **Check Browser Console**

Look for these specific errors:
- Network request failures
- Response status codes
- Error messages from the Edge Function

## 🚨 **Common Issues & Solutions**

### **Issue 1: Missing Environment Variables**

**Symptoms**: 
- 500 error immediately
- Logs show "Missing [VARIABLE] environment variable"

**Solution**:
1. Go to **Supabase Dashboard** → **Settings** → **Edge Functions**
2. Add missing environment variables
3. Redeploy the function

### **Issue 2: Invalid Service Role Key**

**Symptoms**:
- 500 error during database operations
- Logs show database connection failures

**Solution**:
1. Get the correct service role key from **Supabase Dashboard** → **Settings** → **API**
2. Update the `SERVICE_ROLE_KEY` in Edge Functions
3. Redeploy the function

### **Issue 3: OpenRouter API Issues**

**Symptoms**:
- 500 error after idempotency check
- Logs show "OpenRouter API error"

**Solution**:
1. Verify `OPENROUTER_API_KEY` is valid
2. Check OpenRouter API status
3. Ensure API key has sufficient credits

### **Issue 4: Database Schema Issues**

**Symptoms**:
- 500 error during course insertion
- Logs show database constraint violations

**Solution**:
1. Run the database migrations:
   ```sql
   -- Run this in Supabase SQL Editor
   -- Migration: 20250821090003_prevent_duplicate_courses.sql
   ```

## 🧪 **Testing After Fixes**

### **Test 1: Basic Course Generation**
1. Create a simple course without file upload
2. Use a basic topic like "Introduction to Programming"
3. Check if generation completes successfully

### **Test 2: File Upload + Course Generation**
1. Upload a simple text file
2. Generate course with the uploaded content
3. Verify course appears in dashboard

### **Test 3: Duplicate Prevention**
1. Try to generate the same course twice
2. Verify only one course is created
3. Check for appropriate error messages

## 📊 **Monitoring & Verification**

### **Success Indicators**
- ✅ Course generation completes in under 2 minutes
- ✅ No 500 errors in Edge Function logs
- ✅ Courses appear in dashboard immediately
- ✅ File uploads work correctly

### **Performance Metrics**
- **Edge Function Response Time**: Should be under 30 seconds
- **Database Insert Time**: Should be under 5 seconds
- **OpenRouter API Response**: Should be under 15 seconds

## 🔄 **Rollback Plan**

If issues persist:

1. **Revert Edge Function**: Deploy previous version from Supabase Dashboard
2. **Check Environment Variables**: Ensure all required variables are set
3. **Verify Database**: Run `SELECT * FROM courses LIMIT 1;` to check table access
4. **Test Basic Functionality**: Try simple course generation without file upload

## 📞 **Getting Help**

If you still encounter issues:

1. **Check Edge Function Logs** for specific error messages
2. **Run the debug script** to isolate the problem
3. **Verify environment variables** are correctly set
4. **Check Supabase service status** at https://status.supabase.com

## 🎯 **Expected Outcome**

After applying these fixes:
- ✅ Upload button works correctly
- ✅ Course generation completes without 500 errors
- ✅ Exactly one course created per generation
- ✅ Proper error handling and user feedback
- ✅ Robust duplicate prevention

---

**Last Updated**: August 21, 2025  
**Status**: Ready for Implementation  
**Priority**: High (Critical Fix)
