# GEN-COACH Latest Fixes Deployment Guide

## 🚀 Overview

This guide covers the deployment of critical fixes for:
1. **Upload Button Functionality** - Fixes file picker not opening
2. **Duplicate Course Prevention** - Enhanced idempotency protection
3. **Database Triggers** - Additional safeguard against duplicates

## 📋 Pre-Deployment Checklist

- [ ] Supabase project is running and accessible
- [ ] Environment variables are configured
- [ ] Database access permissions are set
- [ ] Edge Functions deployment access is available

## 🔧 Step 1: Update Supabase Edge Functions

### 1.1 Update generate-course Function

**File**: `supabase/functions/generate-course/index.ts`

**Steps**:
1. Navigate to **Supabase Dashboard** → **Edge Functions**
2. Find the `generate-course` function
3. Click **Edit** or **Update**
4. Replace the entire content with the updated code
5. Click **Deploy**

**Key Changes**:
- Enhanced idempotency checking with request ID tracking
- Additional duplicate prevention for recent courses with same topic
- Better error handling and logging
- Returns existing course ID if duplicate detected

### 1.2 Verify Environment Variables

Ensure these are set in **Supabase Dashboard** → **Settings** → **Edge Functions**:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
SUPABASE_URL=your_supabase_url
SERVICE_ROLE_KEY=your_service_role_key
```

## 🗄️ Step 2: Database Migrations

### 2.1 Run Language Preference Migration

**File**: `supabase/migrations/20250821090002_add_language_preference.sql`

**Steps**:
1. Navigate to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy and paste the migration SQL
4. Click **Run**
5. Verify the `language_preference` column was added to `profiles` table

**Expected Result**:
- New column `language_preference` in `profiles` table
- Default value set to 'en'
- RLS policies updated

### 2.2 Run Duplicate Prevention Migration

**File**: `supabase/migrations/20250821090003_prevent_duplicate_courses.sql`

**Steps**:
1. In **SQL Editor**, create another new query
2. Copy and paste the duplicate prevention migration SQL
3. Click **Run**
4. Verify the trigger and function were created

**Expected Result**:
- New function `check_recent_course_duplicate()` created
- New trigger `prevent_duplicate_courses_trigger` created
- New index `idx_courses_user_topic_created` created

### 2.3 Verify Migration Success

Run this query to verify all components were created:

```sql
-- Check if language preference column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'language_preference';

-- Check if duplicate prevention trigger exists
SELECT trigger_name, event_manipulation, action_timing, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'prevent_duplicate_courses_trigger';

-- Check if function exists
SELECT routine_name, routine_type, routine_definition
FROM information_schema.routines 
WHERE routine_name = 'check_recent_course_duplicate';
```

## 🎯 Step 3: Frontend Deployment

### 3.1 Automatic Deployment (Vercel)

If using Vercel with GitHub integration:
1. Push changes to your main branch
2. Vercel will automatically deploy
3. Monitor deployment logs for any build errors

### 3.2 Manual Deployment (if needed)

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Ensure environment variables are set in your hosting platform

## 🧪 Step 4: Testing & Verification

### 4.1 Test Upload Button Functionality

**Test Case**: File picker opens when clicking "Choose File"

**Steps**:
1. Open the app in browser
2. Navigate to Course Creation
3. Click "Choose File" button
4. **Expected**: OS file picker opens
5. **Not Expected**: No file picker, or course generation starts

**Test on**:
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari
- [ ] Mobile Chrome
- [ ] Mobile Safari

### 4.2 Test Duplicate Course Prevention

**Test Case**: Only one course created per generation

**Steps**:
1. Create a new course with a unique topic
2. Wait for generation to complete
3. Check course list
4. **Expected**: Exactly 1 course appears
5. **Not Expected**: Multiple courses or empty courses

**Test Scenarios**:
- [ ] Normal course creation
- [ ] Rapid successive clicks (should be prevented)
- [ ] Same topic within 1 hour (should be prevented)
- [ ] Different topics (should work normally)

### 4.3 Test Language Support

**Test Case**: TTS works in selected language

**Steps**:
1. Create course in different language (e.g., French)
2. Navigate to course content
3. Click play button for TTS
4. **Expected**: Audio plays in selected language
5. **Not Expected**: Audio plays in wrong language or fails

**Test Languages**:
- [ ] English (en)
- [ ] French (fr)
- [ ] Pidgin (pcm)
- [ ] Igbo (ig)

## 🔍 Step 5: Monitoring & Debugging

### 5.1 Check Edge Function Logs

**Location**: **Supabase Dashboard** → **Edge Functions** → **Logs**

**Look for**:
- Successful course generation requests
- Idempotency check logs
- Duplicate prevention triggers
- Any error messages

**Expected Logs**:
```
Performing idempotency check for request ID: course_1234567890_abc123
Idempotency check passed - no duplicates found
Course saved successfully with ID: uuid-here, Request ID: course_1234567890_abc123
```

### 5.2 Check Database Logs

**Location**: **Supabase Dashboard** → **Logs**

**Look for**:
- Course insertion operations
- Trigger executions
- Any constraint violations

### 5.3 Browser Console

**Check for**:
- JavaScript errors
- Network request failures
- TTS generation errors

## 🚨 Troubleshooting

### Common Issues

#### 1. Upload Button Still Not Working

**Symptoms**: Clicking "Choose File" doesn't open file picker

**Solutions**:
- Check browser console for JavaScript errors
- Verify the button has `onClick={handleUploadClick}`
- Ensure `fileInputRef` is properly connected
- Test in different browser/device

#### 2. Duplicate Courses Still Appearing

**Symptoms**: Multiple courses created per generation

**Solutions**:
- Check Edge Function logs for idempotency check failures
- Verify database trigger was created successfully
- Check if `requestId` is being passed correctly
- Monitor database operations in Supabase logs

#### 3. Migration Errors

**Symptoms**: SQL migration fails to execute

**Solutions**:
- Check SQL syntax for typos
- Verify you have sufficient database permissions
- Ensure no conflicting objects exist
- Run migrations in correct order

#### 4. Edge Function Deployment Fails

**Symptoms**: Function update fails or doesn't deploy

**Solutions**:
- Check environment variables are set
- Verify function code syntax
- Check Supabase service status
- Try redeploying after a few minutes

## ✅ Post-Deployment Checklist

- [ ] Upload button opens file picker on all tested devices
- [ ] Course generation creates exactly one course per request
- [ ] Language preference is saved and respected
- [ ] TTS works in all supported languages
- [ ] No JavaScript errors in browser console
- [ ] Edge Function logs show successful operations
- [ ] Database triggers are active and working
- [ ] All existing functionality remains intact

## 📊 Performance Monitoring

### Metrics to Watch

1. **Course Generation Time**: Should remain under 2 minutes
2. **TTS Response Time**: Should be under 5 seconds
3. **Database Query Performance**: No significant degradation
4. **Error Rates**: Should be minimal

### Alerts to Set

- High error rate in Edge Functions
- Database connection issues
- API rate limit warnings
- Unusual course generation patterns

## 🔄 Rollback Plan

If issues arise, you can rollback by:

1. **Frontend**: Revert to previous Git commit
2. **Edge Functions**: Redeploy previous version from Supabase Dashboard
3. **Database**: Drop the new trigger and function (if needed)

**Rollback SQL**:
```sql
-- Remove duplicate prevention trigger and function
DROP TRIGGER IF EXISTS prevent_duplicate_courses_trigger ON courses;
DROP FUNCTION IF EXISTS check_recent_course_duplicate();

-- Remove index
DROP INDEX IF EXISTS idx_courses_user_topic_created;
```

## 📞 Support

If you encounter issues:

1. **Check this guide** for troubleshooting steps
2. **Review Supabase logs** for error details
3. **Check browser console** for frontend errors
4. **Verify environment variables** are correctly set
5. **Test in different browsers/devices** to isolate issues

## 🎉 Success Criteria

The deployment is successful when:

✅ **Upload Button**: Opens file picker reliably on all devices  
✅ **Course Generation**: Creates exactly one course per request  
✅ **Duplicate Prevention**: No duplicate courses appear  
✅ **Language Support**: TTS works in all supported languages  
✅ **Performance**: No degradation in existing functionality  
✅ **Stability**: No new errors or crashes introduced  

---

**Deployment Date**: August 21, 2025  
**Version**: 2.1.0  
**Status**: Ready for Production
