-- Migration: Add language preference and ensure profile consistency
-- Date: 2025-08-21
-- Description: Adds language_preference column to profiles table and ensures proper profile creation triggers

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

-- 7. Ensure RLS is enabled on courses table
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 8. Create or replace RLS policies for courses
DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
CREATE POLICY "Users can view their own courses"
  ON public.courses
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own courses" ON public.courses;
CREATE POLICY "Users can insert their own courses"
  ON public.courses
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own courses" ON public.courses;
CREATE POLICY "Users can update their own courses"
  ON public.courses
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own courses" ON public.courses;
CREATE POLICY "Users can delete their own courses"
  ON public.courses
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- 9. Create index on language_preference for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_language_preference 
ON public.profiles(language_preference);

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO public;
GRANT ALL ON public.profiles TO public;
GRANT ALL ON public.courses TO public;

-- 11. Verify the setup
DO $$
BEGIN
  -- Check if language_preference column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'language_preference'
  ) THEN
    RAISE EXCEPTION 'language_preference column not found in profiles table';
  END IF;
  
  -- Check if trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE EXCEPTION 'on_auth_user_created trigger not found';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
END $$;


