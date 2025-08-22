-- Add language preference to profiles and ensure profile consistency

-- 1) Add language_preference column with default 'en'
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS language_preference text NOT NULL DEFAULT 'en';

-- 2) Backfill NULLs to 'en' (defensive)
UPDATE public.profiles
SET language_preference = 'en'
WHERE language_preference IS NULL;

-- 3) Ensure handle_new_user trigger/function exists and inserts a profile row on signup
-- Recreate the function idempotently to include minimal logic if missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5) Policies are already in place from previous migrations; no changes required here


