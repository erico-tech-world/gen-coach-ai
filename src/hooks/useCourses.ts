import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { cloudflareR2Storage } from "@/services/cloudflareR2Storage";

type CourseRow = Database['public']['Tables']['courses']['Row'];
type CourseInsert = Database['public']['Tables']['courses']['Insert'];

export interface Course {
  id: string;
  user_id: string;
  title: string;
  topic?: string | null;
  modules: Array<{
    id: string;
    title: string;
    content?: string;
    test?: string;
    completed: boolean;
    expanded?: boolean;
  }>;
  schedule: string;
  progress: number;
  additional_details?: string | null;
  file_url?: string | null;
  youtube_links: Array<{
    url: string;
    title: string;
  }>;
  wikipedia_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const transformCourseRow = (row: CourseRow): Course => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  topic: row.topic,
  modules: Array.isArray(row.modules) ? row.modules as Course['modules'] : [],
  schedule: row.schedule || 'Self-paced',
  progress: row.progress || 0,
  additional_details: row.additional_details,
  file_url: row.file_url || null,
  youtube_links: Array.isArray(row.youtube_links) ? row.youtube_links as Course['youtube_links'] : [],
  wikipedia_data: typeof row.wikipedia_data === 'object' && row.wikipedia_data !== null ? row.wikipedia_data as Record<string, unknown> : {},
  created_at: row.created_at,
  updated_at: row.updated_at
});

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCourses((data || []).map(transformCourseRow));
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "Failed to load courses. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCourse = async (courseData: {
    title: string;
    topic?: string;
    modules?: Course['modules'];
    additional_details?: string;
  }) => {
    try {
      const insertData: CourseInsert = {
        title: courseData.title,
        topic: courseData.topic,
        modules: courseData.modules || [],
        additional_details: courseData.additional_details,
        progress: 0,
        youtube_links: [],
        wikipedia_data: {},
        user_id: (await supabase.auth.getUser()).data.user?.id || ''
      };

      const { data, error } = await supabase
        .from('courses')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      const newCourse = transformCourseRow(data);
      setCourses(prev => [newCourse, ...prev]);
      toast({
        title: "Success!",
        description: "Course created successfully.",
      });

      return newCourse;
    } catch (error) {
      console.error('Error creating course:', error);
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateCourse = async (courseId: string, updates: Partial<Course>) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const updatedCourse = transformCourseRow(data);
      setCourses(prev => prev.map(course => 
        course.id === courseId ? updatedCourse : course
      ));

      return updatedCourse;
    } catch (error) {
      console.error('Error updating course:', error);
      toast({
        title: "Error",
        description: "Failed to update course. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      // First, get the course to check if it has associated files
      const courseToDelete = courses.find(course => course.id === courseId);
      if (!courseToDelete) {
        throw new Error('Course not found');
      }

      // If the course has a file URL, delete the file from storage first
      if (courseToDelete.file_url) {
        try {
          // Prefer Cloudflare R2 deletion via Edge Function when configured
          const deleted = await cloudflareR2Storage.deleteFile(courseToDelete.file_url);
          if (!deleted) {
            console.warn('R2 deletion failed or not configured. Attempting Supabase Storage cleanup as fallback.');
            // Fallback: best-effort cleanup in Supabase Storage if URL matches that bucket
            const urlParts = courseToDelete.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const userId = urlParts[urlParts.length - 2];
            const filePath = `course-uploads/${userId}/${fileName}`;
            const { error: storageError } = await supabase.storage
              .from('user-uploads')
              .remove([filePath]);
            if (storageError) {
              console.warn('Failed to delete file from Supabase Storage:', storageError);
            }
          }
        } catch (fileError) {
          console.warn('Error deleting file from storage:', fileError);
          // Continue with course deletion even if file deletion fails
        }
      }

      // Now delete the course from the database
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        throw error;
      }

      setCourses(prev => prev.filter(course => course.id !== courseId));
      
      toast({
        title: "Success!",
        description: "Course deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: "Failed to delete course. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return {
    courses,
    isLoading,
    createCourse,
    updateCourse,
    deleteCourse,
    refetchCourses: fetchCourses
  };
}