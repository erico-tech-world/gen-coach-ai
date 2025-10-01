-- Migration: Add file metadata and TTS session persistence
-- Date: 2025-08-24

-- Add file metadata columns to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create TTS session persistence table
CREATE TABLE IF NOT EXISTS public.tts_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL DEFAULT '{}',
    current_position INTEGER DEFAULT 0,
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI chat memory table
CREATE TABLE IF NOT EXISTS public.ai_chat_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for new tables
ALTER TABLE public.tts_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_memory ENABLE ROW LEVEL SECURITY;

-- TTS Sessions policies
CREATE POLICY "Users can view their own TTS sessions" ON public.tts_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TTS sessions" ON public.tts_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TTS sessions" ON public.tts_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TTS sessions" ON public.tts_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- AI Chat Memory policies
CREATE POLICY "Users can view their own chat memory" ON public.ai_chat_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat memory" ON public.ai_chat_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat memory" ON public.ai_chat_memory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat memory" ON public.ai_chat_memory
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tts_sessions_user_id ON public.tts_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_sessions_course_id ON public.tts_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_memory_user_id ON public.ai_chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_memory_session_id ON public.ai_chat_memory(session_id);

-- Update existing RLS policies for courses to include new columns
DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
CREATE POLICY "Users can view their own courses" ON public.courses
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own courses" ON public.courses;
CREATE POLICY "Users can insert their own courses" ON public.courses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own courses" ON public.courses;
CREATE POLICY "Users can update their own courses" ON public.courses
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own courses" ON public.courses;
CREATE POLICY "Users can delete their own courses" ON public.courses
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tts_sessions_updated_at 
    BEFORE UPDATE ON public.tts_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chat_memory_updated_at 
    BEFORE UPDATE ON public.ai_chat_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
