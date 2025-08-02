-- COMPREHENSIVE FIX: Run this in Supabase SQL Editor
-- This will fix all authentication and database issues

-- 1. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create courses table if it doesn't exist
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  topic text,
  modules jsonb DEFAULT '[]'::jsonb,
  schedule text DEFAULT 'Self-paced',
  progress integer DEFAULT 0,
  additional_details text,
  youtube_links jsonb DEFAULT '[]'::jsonb,
  wikipedia_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT courses_progress_check CHECK (progress >= 0 AND progress <= 100)
);

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create improved function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO profiles (user_id, name)
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    )
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
$$ language 'plpgsql';

-- 5. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 7. Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 8. Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- 9. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own courses" ON courses;
DROP POLICY IF EXISTS "Users can create their own courses" ON courses;
DROP POLICY IF EXISTS "Users can update their own courses" ON courses;
DROP POLICY IF EXISTS "Users can delete their own courses" ON courses;

-- 10. Create policies for profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

-- 11. Create policies for courses
CREATE POLICY "Users can view their own courses"
  ON courses
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own courses"
  ON courses
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses"
  ON courses
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses"
  ON courses
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(title);

-- 13. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 14. Grant permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;

-- 15. Insert profiles for any existing users that don't have profiles
INSERT INTO profiles (user_id, name)
SELECT 
  id, 
  COALESCE(
    raw_user_meta_data->>'name', 
    split_part(email, '@', 1)
  ) as name
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 16. Verify the setup
SELECT 
  'Profiles table exists' as check_item,
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') as result
UNION ALL
SELECT 
  'Courses table exists',
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'courses')
UNION ALL
SELECT 
  'Trigger function exists',
  EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'handle_new_user')
UNION ALL
SELECT 
  'Trigger exists',
  EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
UNION ALL
SELECT 
  'RLS enabled on profiles',
  EXISTS (SELECT FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = true)
UNION ALL
SELECT 
  'RLS enabled on courses',
  EXISTS (SELECT FROM pg_tables WHERE tablename = 'courses' AND rowsecurity = true); 