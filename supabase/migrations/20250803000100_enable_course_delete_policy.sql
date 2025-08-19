-- Ensure delete policy exists for courses table so users can delete their own courses

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;

-- Allow users to delete their own courses
DROP POLICY IF EXISTS "Users can delete their own courses" ON public.courses;
CREATE POLICY "Users can delete their own courses"
  ON public.courses
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Optional: allow users to select and view their own courses (idempotent)
DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
CREATE POLICY "Users can view their own courses"
  ON public.courses
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);


