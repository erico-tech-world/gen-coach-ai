-- Migration: Prevent Duplicate Courses
-- Date: 2025-08-21
-- Purpose: Add database-level constraints to prevent duplicate course creation

-- Add a unique constraint on user_id + topic + created_at (within 1 hour) to prevent rapid duplicates
-- This allows legitimate courses but prevents accidental duplicates from multiple API calls

-- First, create a function to check for recent duplicates
CREATE OR REPLACE FUNCTION check_recent_course_duplicate()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if a course with the same topic was created by the same user within the last hour
  IF EXISTS (
    SELECT 1 FROM courses 
    WHERE user_id = NEW.user_id 
      AND topic = NEW.topic 
      AND created_at > NOW() - INTERVAL '1 hour'
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'A course with this topic was already created recently. Please wait before creating another similar course.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to call this function before insert
DROP TRIGGER IF EXISTS prevent_duplicate_courses_trigger ON courses;
CREATE TRIGGER prevent_duplicate_courses_trigger
  BEFORE INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION check_recent_course_duplicate();

-- Add an index to improve performance of duplicate checking
CREATE INDEX IF NOT EXISTS idx_courses_user_topic_created 
  ON courses(user_id, topic, created_at);

-- Add a comment to document the purpose
COMMENT ON FUNCTION check_recent_course_duplicate() IS 'Prevents creation of duplicate courses by the same user within 1 hour';
COMMENT ON TRIGGER prevent_duplicate_courses_trigger ON courses IS 'Triggers duplicate checking before course insertion';

-- Verify the trigger was created
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'prevent_duplicate_courses_trigger';
