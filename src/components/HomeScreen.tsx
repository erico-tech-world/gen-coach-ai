import { useState, useEffect } from "react";
import { Plus, BookOpen, Clock, Users, LogOut, Mic, ArrowLeft, Trash2, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseCreationOverlay } from "./CourseCreationOverlay";
import { CourseMaterialPage } from "./CourseMaterialPage";
import { RealtimeVoiceChat } from "./RealtimeVoiceChat";
import { SettingsOverlay } from "./SettingsOverlay";
import { useCourses, Course } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export function HomeScreen() {
  const [showCreationOverlay, setShowCreationOverlay] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const { courses, isLoading, createCourse, deleteCourse } = useCourses();
  const { signOut, user } = useAuth();
  const { userName } = useProfile();
  const { toast } = useToast();

  // Handle voice chat session termination when leaving the page
  useEffect(() => {
    return () => {
      // Cleanup function to terminate voice chat session when component unmounts
      if (showVoiceChat) {
        // This will be handled by the RealtimeVoiceChat component's cleanup
        setShowVoiceChat(false);
      }
    };
  }, [showVoiceChat]);

  const handleCourseCreated = async (courseData: {
    title: string;
    topic?: string;
    additional_details?: string;
  }) => {
    try {
      const newCourse = await createCourse({
        title: courseData.title,
        topic: courseData.topic,
        additional_details: courseData.additional_details,
        modules: [
          { id: '1', title: "Introduction", completed: false },
          { id: '2', title: "Core Concepts", completed: false },
          { id: '3', title: "Advanced Topics", completed: false },
          { id: '4', title: "Practice & Assessment", completed: false }
        ]
      });
      setShowCreationOverlay(false);
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${courseTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingCourseId(courseId);
    try {
      await deleteCourse(courseId);
      toast({
        title: "Course Deleted",
        description: `"${courseTitle}" has been permanently deleted.`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete course. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingCourseId(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force redirect to auth page
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force redirect anyway
      window.location.href = '/';
    }
  };

  const handleVoiceChatToggle = (show: boolean) => {
    setShowVoiceChat(show);
    // Reset other states when switching to voice chat
    if (show) {
      setSelectedCourse(null);
      setShowCreationOverlay(false);
      setShowSettings(false);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    // Reset other states when selecting a course
    setShowVoiceChat(false);
    setShowCreationOverlay(false);
    setShowSettings(false);
  };

  const handleBackToHome = () => {
    setSelectedCourse(null);
    setShowVoiceChat(false);
    setShowCreationOverlay(false);
    setShowSettings(false);
  };

  if (showVoiceChat) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleVoiceChatToggle(false)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">AI Voice Chat</h1>
        </div>
        <RealtimeVoiceChat onUnmount={() => {
          // Only close voice chat when component unmounts, not on every interaction
          console.log('Voice chat component unmounting');
        }} />
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <CourseMaterialPage
        courseId={selectedCourse.id}
        courseTitle={selectedCourse.title}
        onBack={handleBackToHome}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
        </div>
        
          {/* Courses Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-48">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Welcome back, {userName}!
            </h1>
            <p className="text-muted-foreground">
              Continue your learning journey with AI-powered courses
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleVoiceChatToggle(true)}
              className="flex"
            >
              <Mic className="w-4 h-4 mr-2" />
              AI Voice Chat
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="h-10 w-10"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-10 w-10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:hidden">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{courses.length}</div>
              <div className="text-sm text-muted-foreground">Total Courses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">
                {courses.filter(course => course.progress === 100).length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Stats */}
        <div className="hidden sm:flex items-center gap-6 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{courses.length}</div>
                <div className="text-sm text-muted-foreground">Total Courses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {courses.filter(course => course.progress === 100).length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
            </div>
            
        {/* Create Course Button */}
        <div className="mb-8">
              <Button
            onClick={() => setShowCreationOverlay(true)}
            className="w-full sm:w-auto"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Course
              </Button>
      </div>

      {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
            <Card key={course.id} className="group hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold line-clamp-2">
                      {course.title}
                    </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                    onClick={() => handleDeleteCourse(course.id, course.title)}
                    disabled={deletingCourseId === course.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  >
                    {deletingCourseId === course.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                      </Button>
                    </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.modules?.length || 0} modules</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{course.schedule || 'Self-paced'}</span>
                    </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {course.progress}% Complete
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCourseSelect(course)}
                    >
                      Continue
                    </Button>
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {courses.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI-powered course to start learning
            </p>
            <Button onClick={() => setShowCreationOverlay(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Course
            </Button>
          </div>
        )}
      </div>

      {/* Overlays */}
        <CourseCreationOverlay
          isOpen={showCreationOverlay}
          onClose={() => setShowCreationOverlay(false)}
        onCourseCreated={handleCourseCreated}
      />

      <SettingsOverlay
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}