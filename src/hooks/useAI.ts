import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CourseGenerationResult {
  courseId?: string;
  title: string;
  modules: Array<{
    id: string;
    title: string;
    content: string;
    test: string;
    completed: boolean;
  }>;
  youtubeLinks: Array<{
    title: string;
    url: string;
    thumbnail: string;
  }>;
  wikipediaData: Record<string, unknown>;
}

export function useAI() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const currentRequestRef = useRef<string | null>(null);

  const generateCourse = async (prompt: string, userName?: string, language: string = 'en', fileUrl?: string | null, fileSize?: number): Promise<CourseGenerationResult | null> => {
    // Prevent duplicate requests
    if (isGenerating) {
      console.log('Course generation already in progress, ignoring duplicate request');
      return null;
    }

    // Generate unique request ID for idempotency
    const requestId = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    currentRequestRef.current = requestId;
    
    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Generating course with prompt:', prompt, 'Request ID:', requestId, 'File URL:', fileUrl, 'File Size:', fileSize);

      const { data, error } = await supabase.functions.invoke('generate-course', {
        body: {
          prompt,
          userId: user.id,
          userName,
          language,
          requestId, // Add request ID for idempotency
          fileUrl, // Add file URL if provided
          fileSize // Add file size if provided
        }
      });

      // Check if this request is still current
      if (currentRequestRef.current !== requestId) {
        console.log('Request superseded by newer request, aborting');
        return null;
      }

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Course generation failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from course generation service');
      }

      toast({
        title: "Course Generated!",
        description: "Your AI-powered course has been created successfully.",
      });

      return data;
    } catch (error) {
      console.error('Course generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate course. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      // Only clear if this is still the current request
      if (currentRequestRef.current === requestId) {
        setIsGenerating(false);
        currentRequestRef.current = null;
      }
    }
  };

  const validateTest = async (question: string, answer: string, userName?: string): Promise<{ credible: boolean; reason: string } | null> => {
    try {
      console.log('Validating test answer...');

      const { data, error } = await supabase.functions.invoke('validate-test', {
        body: {
          question,
          answer,
          userName
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Test validation failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from validation service');
      }

      return data;
    } catch (error) {
      console.error('Test validation error:', error);
      toast({
        title: "Validation Failed",
        description: error instanceof Error ? error.message : "Failed to validate test answer. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const buildLecture = async (outline: string, topic: string, wikipediaSummary?: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('lecture-mode', {
        body: { outline, topic, wikipediaSummary }
      });

      if (error) {
        throw new Error(error.message);
      }
      if (!data || data.success !== true || !data.lecture) {
        throw new Error(data?.error || 'Failed to generate lecture');
      }
      return data.lecture as string;
    } catch (e) {
      console.error('Lecture build error:', e);
      toast({
        title: 'Lecture Generation Failed',
        description: e instanceof Error ? e.message : 'Could not generate lecture script.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    generateCourse,
    validateTest,
    buildLecture,
    isGenerating
  };
}