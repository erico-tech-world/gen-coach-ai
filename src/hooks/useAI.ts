import { useState } from "react";
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
  wikipediaData: any;
}

export function useAI() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateCourse = async (prompt: string, userName?: string): Promise<CourseGenerationResult | null> => {
    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Generating course with prompt:', prompt);

      const { data, error } = await supabase.functions.invoke('generate-course', {
        body: {
          prompt,
          userId: user.id,
          userName
        }
      });

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
      setIsGenerating(false);
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