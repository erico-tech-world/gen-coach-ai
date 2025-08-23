# GEN-COACH Complete Setup Guide

## 🚀 Implementation Summary

This guide covers all the fixes and improvements implemented for the GEN-COACH application:

### ✅ **Completed Fixes & Improvements**

1. **Settings Responsiveness** - Mobile-first design with proper tab layout
2. **Authentication Icons** - Proper Google logo integration
3. **User Naming** - First name display logic implemented
4. **Loading States** - Better UX for course creation and TTS
5. **AI Voice Chat** - Enhanced intelligence and helpfulness
6. **Delete Account** - Robust account deletion with proper cleanup
7. **Mobile Optimization** - Comprehensive responsive design
8. **Documentation** - Complete project documentation updated

---

## 📋 **Manual Setup Steps**

### **Step 1: Database Migration**

Run this SQL in your Supabase SQL Editor:

```sql
-- Migration: Add language preference and ensure profile consistency
-- Date: 2025-08-21

-- 1. Add language_preference column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'fr', 'pcm', 'ig'));

-- 2. Update existing profiles to have default language preference
UPDATE public.profiles 
SET language_preference = 'en' 
WHERE language_preference IS NULL;

-- 3. Create or replace the handle_new_user function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile for new user with language preference
  INSERT INTO public.profiles (user_id, name, language_preference)
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    ),
    'en' -- Default language preference
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, do nothing
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop and recreate the trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create or replace RLS policies for profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.courses TO anon, authenticated;

-- 8. Create index for better performance on language preference queries
CREATE INDEX IF NOT EXISTS idx_profiles_language_preference ON public.profiles(language_preference);

-- 9. Add comment to document the language preference column
COMMENT ON COLUMN public.profiles.language_preference IS 'User preferred language for course generation and AI interactions. Supported values: en (English), fr (French), pcm (Pidgin), ig (Igbo)';
```

### **Step 2: Update Edge Functions**

#### **A. Update `realtime-voice-chat` Function**

1. Go to Supabase Dashboard → Edge Functions
2. Open `realtime-voice-chat` function
3. Replace the entire code with the updated version from the repository
4. Deploy the function

#### **B. Verify Other Edge Functions**

Ensure these functions are deployed and up-to-date:
- `generate-course`
- `text-to-speech`
- `lecture-mode`
- `translate-text`
- `delete-account`
- `validate-test`

### **Step 3: Configure Authentication**

#### **A. Google OAuth Setup**

1. **Create Google OAuth Client**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Set name: "GEN-COACH Web Client"

2. **Configure Authorized Origins**:
   ```
   http://localhost:3000
   http://localhost:8080
   https://gen-coach-ai.vercel.app
   https://your-custom-domain.com (if applicable)
   ```

3. **Configure Authorized Redirect URIs**:
   ```
   http://localhost:3000/
   http://localhost:8080/
   https://gen-coach-ai.vercel.app/
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

4. **Configure in Supabase**:
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add your Google Client ID and Client Secret
   - Set redirect URL to: `https://your-project-ref.supabase.co/auth/v1/callback`

#### **B. Email Templates (Optional)**

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Customize the email templates with GEN-COACH branding
3. Update confirmation and reset password emails

### **Step 4: Environment Variables**

Ensure these are set in your Supabase project:

#### **Required Variables**:
```bash
# AI Services
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key

# Supabase (for Edge Functions)
SUPABASE_URL=your_supabase_url
SERVICE_ROLE_KEY=your_service_role_key
```

#### **Optional Variables**:
```bash
# Translation Service
HUGGING_FACE_API_KEY=your_hugging_face_key
```

### **Step 5: Verify File Assets**

Ensure these files are in your `/public` folder:
- `GenCoachImg.png` - GEN-COACH logo
- `googleLogo.png` - Google OAuth button logo
- `favicon.ico` - Site favicon

---

## 🧪 **Testing Checklist**

### **Core Functionality**
- [ ] **User Registration**: Test email/password signup
- [ ] **Google OAuth**: Test Google sign-in flow
- [ ] **Profile Creation**: Verify profile is created automatically
- [ ] **First Name Display**: Check that only first name shows in UI
- [ ] **Language Preference**: Test language selection in settings
- [ ] **Course Creation**: Test AI course generation with different languages
- [ ] **TTS Functionality**: Test text-to-speech playback
- [ ] **Voice Chat**: Test AI voice chat assistant
- [ ] **Settings**: Test all settings tabs and functionality
- [ ] **Account Deletion**: Test account deletion flow

### **Responsive Design**
- [ ] **Mobile (320px-768px)**: Test all components on mobile
- [ ] **Tablet (768px-1024px)**: Test tablet layout
- [ ] **Desktop (1024px+)**: Test desktop experience
- [ ] **Settings Modal**: Verify responsive tabs work on all devices
- [ ] **Course Cards**: Check responsive grid layout
- [ ] **Authentication**: Test auth forms on mobile

### **Performance**
- [ ] **Page Load**: Check initial page load times
- [ ] **Course Generation**: Verify 1-2 minute generation time
- [ ] **TTS Response**: Check audio generation speed
- [ ] **Voice Chat**: Test response time
- [ ] **Loading States**: Verify proper loading indicators

### **Error Handling**
- [ ] **Network Issues**: Test offline behavior
- [ ] **API Failures**: Test with invalid API keys
- [ ] **Form Validation**: Test invalid inputs
- [ ] **Authentication Errors**: Test failed login attempts

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **1. Google OAuth Not Working**
- **Symptom**: "Invalid redirect URI" error
- **Solution**: 
  - Check redirect URIs in Google Cloud Console
  - Ensure Supabase redirect URL is correct
  - Verify domain is in authorized origins

#### **2. TTS Not Working**
- **Symptom**: "Speech generation failed" error
- **Solution**:
  - Check Groq API key in Supabase environment variables
  - Verify API quota and limits
  - Check Edge Function logs for errors

#### **3. Course Generation Failing**
- **Symptom**: "Course generation failed" error
- **Solution**:
  - Check OpenRouter API key
  - Verify API quota and limits
  - Check Edge Function logs

#### **4. Profile Not Created**
- **Symptom**: User exists but no profile row
- **Solution**:
  - Run the database migration
  - Check trigger function exists
  - Verify RLS policies

#### **5. Mobile Layout Issues**
- **Symptom**: Elements not responsive
- **Solution**:
  - Clear browser cache
  - Check CSS classes are applied
  - Verify Tailwind CSS is loading

### **Debug Steps**

1. **Check Browser Console**: Look for JavaScript errors
2. **Check Network Tab**: Verify API calls are successful
3. **Check Supabase Logs**: Review Edge Function execution logs
4. **Check Database**: Verify data is being created/updated
5. **Test on Different Devices**: Verify responsive design

---

## 📱 **Mobile Optimization Features**

### **Implemented Improvements**
- **Settings Modal**: Responsive tabs with icons and text
- **Course Cards**: Optimized grid layout for mobile
- **Authentication**: Mobile-friendly forms and buttons
- **Floating Actions**: Mobile-specific action buttons
- **Touch Targets**: Proper sizing for touch interaction
- **Typography**: Responsive text sizing
- **Spacing**: Mobile-optimized padding and margins

### **Mobile-Specific Features**
- **Floating Voice Chat Button**: Bottom-left corner
- **Floating Settings Button**: Bottom-right corner
- **Mobile Stats Cards**: Compact stats display
- **Responsive Navigation**: Collapsible menus
- **Touch-Friendly Buttons**: Large touch targets

---

## 🎯 **Key Features Implemented**

### **1. Enhanced Settings Overlay**
- ✅ Responsive tab design with icons
- ✅ Mobile-first layout
- ✅ Loading states for all actions
- ✅ Proper error handling
- ✅ Account deletion with confirmation

### **2. Improved Authentication**
- ✅ GEN-COACH logo integration
- ✅ Proper Google OAuth branding
- ✅ Responsive form design
- ✅ Better error messages
- ✅ Forgot password functionality

### **3. First Name Display Logic**
- ✅ Automatic first name extraction
- ✅ Fallback to email username
- ✅ Proper capitalization
- ✅ Consistent display throughout app

### **4. Enhanced AI Voice Chat**
- ✅ Academic and intellectual assistance
- ✅ Problem-solving support
- ✅ GEN-COACH feature guidance
- ✅ Conversation memory
- ✅ Context-aware responses

### **5. Mobile Responsiveness**
- ✅ Comprehensive mobile optimization
- ✅ Touch-friendly interfaces
- ✅ Responsive typography
- ✅ Adaptive layouts
- ✅ Mobile-specific features

---

## 🚀 **Deployment Notes**

### **Frontend (Vercel)**
- All changes are automatically deployed
- Environment variables are already configured
- No additional setup required

### **Backend (Supabase)**
- Run the database migration
- Deploy updated Edge Functions
- Configure Google OAuth
- Verify environment variables

### **Post-Deployment**
- Test all functionality thoroughly
- Monitor Edge Function logs
- Check for any console errors
- Verify responsive design on multiple devices

---

## 📞 **Support**

If you encounter any issues:

1. **Check the troubleshooting section above**
2. **Review browser console for errors**
3. **Check Supabase Edge Function logs**
4. **Verify all setup steps are completed**
5. **Test on different devices and browsers**

All the code changes have been implemented and are ready for deployment. The application now features comprehensive mobile responsiveness, enhanced user experience, and robust functionality across all features.

---

**Last Updated**: August 21, 2025  
**Version**: 2.0.0  
**Status**: Ready for Production
