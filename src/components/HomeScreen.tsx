import { useState } from "react";
import { Plus, BookOpen, Clock, Users, LogOut, Mic, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseCreationOverlay } from "./CourseCreationOverlay";
import { CourseMaterialPage } from "./CourseMaterialPage";
import { RealtimeVoiceChat } from "./RealtimeVoiceChat";
import { useCourses, Course } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeScreen() {
  const [showCreationOverlay, setShowCreationOverlay] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const { courses, isLoading, createCourse } = useCourses();
  const { signOut, user } = useAuth();
  const { userName } = useProfile();

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

  if (showVoiceChat) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowVoiceChat(false)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">AI Voice Chat</h1>
        </div>
        <RealtimeVoiceChat />
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <CourseMaterialPage
        courseId={selectedCourse.id}
        courseTitle={selectedCourse.title}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border bg-card">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Skeleton className="h-2 w-full" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-9 w-full" />
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
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ai-gradient flex items-center justify-center shadow-neural-glow">
              <img src="/public/GenCoachImg.png" alt="GEN-COACH Logo" className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to GEN-COACH, {userName}!</h1>
              <p className="text-muted-foreground">AI-powered learning made simple with GEN-COACH</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="hidden md:flex items-center gap-6">
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
            
            {/* User Menu */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVoiceChat(true)}
                className="hidden sm:flex"
              >
                <Mic className="w-4 h-4 mr-2" />
                AI Voice Chat
              </Button>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="max-w-6xl mx-auto">
        {courses.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-ai-gradient mx-auto mb-6 flex items-center justify-center shadow-neural-glow">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-8">
              Create your first AI-generated course to get started
            </p>
            <Button 
              onClick={() => setShowCreationOverlay(true)}
              className="bg-ai-gradient hover:shadow-neural-glow transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Course
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="course-card hover:shadow-course-card transition-all duration-300 border-border bg-card cursor-pointer"
                onClick={() => setSelectedCourse(course)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold text-card-foreground line-clamp-2">
                      {course.title}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {course.modules?.length || 0} modules
                    </Badge>
                  </div>
                  {course.topic && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {course.topic}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-ai-gradient h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${course.progress || 0}%` }}
                      />
                    </div>
                    
                    {/* Course Info */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{course.schedule}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>AI Tutor</span>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full hover:bg-primary/10 hover:border-primary transition-all duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourse(course);
                      }}
                    >
                      {course.progress === 0 ? 'Start Learning' : 'Continue Learning'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        onClick={() => setShowCreationOverlay(true)}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-ai-gradient hover:shadow-neural-glow shadow-floating transition-all duration-300 hover:scale-110"
        size="icon"
      >
        <Plus className="w-6 h-6 text-white" />
      </Button>

      {/* Course Creation Overlay */}
      {showCreationOverlay && (
        <CourseCreationOverlay
          isOpen={showCreationOverlay}
          onClose={() => setShowCreationOverlay(false)}
        />
      )}
    </div>
  );
}