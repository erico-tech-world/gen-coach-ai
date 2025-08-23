-- Migration: Add language_preference column to profiles table
-- This migration adds a language_preference column to store user's preferred language

-- Check if the column already exists before adding it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'language_preference'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN language_preference VARCHAR(10) DEFAULT 'en' NOT NULL;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.profiles.language_preference IS 'User preferred language for TTS and course generation (en, fr, pcm, ig)';
    END IF;
END $$;

-- Update RLS policies to include the new column
-- Ensure the language_preference column is included in RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Ensure the column is included in the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, language_preference)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'en');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
