import { useState, useEffect } from "react";
import { ArrowLeft, Play, Pause, ChevronDown, ChevronRight, CheckCircle2, Circle, MessageSquare, FileText, Volume2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useCourses } from "@/hooks/useCourses";
import { useAI } from "@/hooks/useAI";
import { TestValidationModal } from "@/components/TestValidationModal";
import { useToast } from "@/hooks/use-toast";

interface CourseModule {
  id: string;
  title: string;
  content: string;
  test: string;
  completed: boolean;
  expanded?: boolean;
}

interface CourseMaterialPageProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

export function CourseMaterialPage({ courseId, courseTitle, onBack }: CourseMaterialPageProps) {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [currentTest, setCurrentTest] = useState("");
  const [currentModuleId, setCurrentModuleId] = useState("");
  
  const { speak, isGenerating: isTTSGenerating, isPlaying: isTTSPlaying } = useTextToSpeech();
  const { courses, updateCourse } = useCourses();
  const { buildLecture } = useAI();
  const { toast } = useToast();

  useEffect(() => {
    const loadCourseContent = async () => {
      setIsLoading(true);
      
      try {
        // Find the course in the courses list
        const course = courses.find(c => c.id === courseId);
        
        if (course && course.modules && Array.isArray(course.modules)) {
          // Transform the modules to include expanded state
          const transformedModules = course.modules.map((module: any, index: number) => ({
            ...module,
            expanded: index === 0 // Expand first module by default
          }));
          setModules(transformedModules);
        } else {
          // Fallback modules if course not found or no modules
          const fallbackModules: CourseModule[] = [
            {
              id: "1",
              title: "Introduction & Fundamentals",
              content: `Welcome to ${courseTitle}! This comprehensive course will guide you through all the essential concepts and practical applications you need to master this subject.\n\nIn this introductory module, we'll cover:\n- Core concepts and terminology\n- Historical context and development\n- Real-world applications and importance\n- Learning objectives for the entire course\n\nBy the end of this module, you'll have a solid foundation to build upon in the subsequent modules.`,
              test: "1. What is the main purpose of this introductory module?\na) To provide advanced concepts\nb) To establish foundational knowledge and context\nc) To test existing knowledge\nd) To conclude the course\nAnswer: b\n\n2. What will you gain from completing this module?\na) Expert-level skills\nb) A solid foundation for further learning\nc) Certification\nd) Advanced techniques only\nAnswer: b",
              completed: false,
              expanded: true
            },
            {
              id: "2",
              title: "Core Concepts & Theory",
              content: `Now that you have the foundation, let's dive deeper into the core concepts that form the backbone of ${courseTitle}. This module focuses on building your theoretical understanding.\n\nKey topics include:\n- Fundamental principles and laws\n- Essential terminology and definitions\n- Theoretical frameworks and models\n- Connections between different concepts\n\nThis theoretical knowledge will be crucial for understanding the practical applications we'll explore in later modules.`,
              test: "1. Why is theoretical understanding important?\na) It's not important for practical work\nb) It provides the foundation for practical applications\nc) It's only for academic purposes\nd) It complicates simple concepts\nAnswer: b\n\n2. What is the relationship between theory and practice?\na) They are completely separate\nb) Theory provides the foundation for effective practice\nc) Practice is more important than theory\nd) Theory is outdated\nAnswer: b",
              completed: false,
              expanded: false
            },
            {
              id: "3",
              title: "Practical Applications",
              content: `With a solid theoretical foundation, it's time to see how these concepts apply in real-world scenarios. This module bridges the gap between theory and practice.\n\nYou'll explore:\n- Real-world case studies and examples\n- Practical problem-solving techniques\n- Industry applications and use cases\n- Hands-on exercises and activities\n- Common challenges and solutions\n\nBy the end of this module, you'll be able to apply your knowledge confidently in practical situations.`,
              test: "1. What is the main focus of this module?\na) Advanced theory only\nb) Bridging theory and practice through real-world applications\nc) Historical background\nd) Future predictions\nAnswer: b\n\n2. How do practical applications enhance learning?\na) They don't add value\nb) They make abstract concepts concrete and understandable\nc) They replace the need for theory\nd) They are only for experts\nAnswer: b",
              completed: false,
              expanded: false
            },
            {
              id: "4",
              title: "Advanced Topics & Future Directions",
              content: `In this final module, we'll explore advanced topics and discuss future trends in ${courseTitle}. This module is designed to challenge your understanding and prepare you for continued learning.\n\nAdvanced topics include:\n- Cutting-edge developments and research\n- Complex problem-solving scenarios\n- Integration with other fields\n- Emerging trends and technologies\n- Career opportunities and pathways\n- Resources for continued learning\n\nCompleting this module will give you a comprehensive understanding and prepare you for advanced study or professional application.`,
              test: "1. What characterizes advanced topics in this field?\na) They are simpler than basics\nb) They build on fundamentals and explore complex applications\nc) They are unrelated to previous learning\nd) They are purely theoretical\nAnswer: b\n\n2. What is the goal of discussing future directions?\na) To confuse learners\nb) To prepare for ongoing developments and opportunities\nc) To end the course quickly\nd) To avoid current applications\nAnswer: b",
              completed: false,
              expanded: false
            }
          ];
          setModules(fallbackModules);
        }
      } catch (error) {
        console.error('Error loading course content:', error);
        toast({
          title: "Error Loading Course",
          description: "Failed to load course content. Please try refreshing the page.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseContent();
  }, [courseId, courses, courseTitle, toast]);

  // Synchronize local playing state with TTS playing state
  useEffect(() => {
    if (!isTTSPlaying) {
      setIsPlaying(false);
    }
  }, [isTTSPlaying]);

  const toggleModule = (moduleId: string) => {
    setModules(prev => prev.map(module => 
      module.id === moduleId 
        ? { ...module, expanded: !module.expanded }
        : module
    ));
  };

  const toggleSectionCompletion = async (moduleId: string) => {
    const updatedModules = modules.map(module => 
      module.id === moduleId 
        ? { ...module, completed: !module.completed }
        : module
    );
    
    setModules(updatedModules);
    
    // Update the course in the database
    try {
      const progress = Math.round((updatedModules.filter(m => m.completed).length / updatedModules.length) * 100);
      await updateCourse(courseId, { 
        modules: updatedModules,
        progress 
      });
      
      toast({
        title: "Progress Updated",
        description: `Module ${modules.find(m => m.id === moduleId)?.completed ? 'unmarked' : 'completed'}!`,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleTakeTest = (moduleId: string, test: string) => {
    setCurrentModuleId(moduleId);
    setCurrentTest(test);
    setShowTestModal(true);
  };

  const handleTestValidation = (isCorrect: boolean, feedback: string) => {
    if (isCorrect) {
      toggleSectionCompletion(currentModuleId);
      toast({
        title: "Correct Answer!",
        description: "Great job! The module has been marked as completed.",
      });
    } else {
      toast({
        title: "Keep Learning",
        description: "Review the module content and try again when you're ready.",
        variant: "destructive"
      });
    }
  };

  const calculateProgress = () => {
    const totalModules = modules.length;
    const completedModules = modules.filter(module => module.completed).length;
    return totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
  };

  const handleListen = async () => {
    try {
      if (activeSection) {
        const module = modules.find(module => module.id === activeSection);
        if (module) {
          // Ensure we have valid content to speak
          if (!module.content || module.content.trim().length < 5) {
            toast({
              title: "No Content to Speak",
              description: "This module doesn't have enough content to generate speech.",
              variant: "destructive"
            });
            return;
          }

          // Build an engaging lecture script from outline + content
          const outline = `${module.title}\n${module.content}`;
          const lecture = await buildLecture(outline, courseTitle);
          const shortText = (lecture && lecture.length > 0)
            ? lecture
            : (module.content.length > 500 
              ? `${module.title}. ${module.content.substring(0, 500)}...`
              : `${module.title}. ${module.content}`);
          
          // Clean the text to ensure it's valid for TTS
          const cleanText = shortText
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[^\w\s.,!?-]/g, '') // Remove special characters that might cause issues
            .trim();
          
          if (cleanText.length < 5) {
            toast({
              title: "Invalid Content",
              description: "The content couldn't be processed for speech generation.",
              variant: "destructive"
            });
            return;
          }
          
          console.log('Attempting to speak module:', module.title);
          console.log('Original text length:', shortText.length);
          console.log('Clean text length:', cleanText.length);
          console.log('Clean text preview:', cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''));
          
          await speak(cleanText);
        }
      } else {
        // If no section is selected, speak the course title and first module summary
        const firstModule = modules[0];
        if (firstModule && firstModule.content && firstModule.content.trim().length >= 5) {
          const outline = `${firstModule.title}\n${firstModule.content}`;
          const lecture = await buildLecture(outline, courseTitle);
          const shortText = lecture && lecture.length > 0
            ? lecture
            : `Welcome to ${courseTitle}. ${firstModule.title}. ${firstModule.content.substring(0, 300)}...`;
          
          // Clean the text
          const cleanText = shortText
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s.,!?-]/g, '')
            .trim();
          
          if (cleanText.length >= 5) {
            console.log('Attempting to speak course introduction');
            console.log('Clean text length:', cleanText.length);
            console.log('Clean text preview:', cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''));
            
            await speak(cleanText);
          } else {
            toast({
              title: "No Content to Speak",
              description: "The course introduction couldn't be processed for speech generation.",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "No Content Available",
            description: "No course content is available to speak.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error in handleListen:', error);
      toast({
        title: "TTS Error",
        description: "Failed to generate speech. Please try again or contact support.",
        variant: "destructive"
      });
    }
  };

  const handlePlayPause = () => {
    if (isTTSPlaying) {
      // Stop current speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      // Start playing course introduction or active module
      setIsPlaying(true);
      handleListen();
    }
  };

  const handleParaphrase = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Paraphrase functionality will be available in the next update.",
    });
  };

  const handleExpatiate = () => {
    toast({
      title: "Feature Coming Soon", 
      description: "Expatiate functionality will be available in the next update.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border">
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-2 w-full mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start md:items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-snug break-words">
              {courseTitle}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-1">
              <p className="text-sm md:text-base text-muted-foreground">AI-Generated Course Content</p>
              <Badge variant="secondary" className="w-fit text-xs md:text-sm">
                {Math.round(calculateProgress())}% Complete
              </Badge>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={calculateProgress()} className="h-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6 order-2 md:order-1">
            {/* Course Video/Cover */}
            <Card className="border-border bg-card overflow-hidden">
              <div className="aspect-video bg-ai-gradient relative flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 mx-auto">
                    <img src="/GenCoachImg.png" alt="GEN-COACH Logo" className="w-14 h-14" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">GEN-COACH Course Content</h3>
                  <div className="flex items-center gap-2 justify-center">
                    <Volume2 className="w-4 h-4" />
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="w-1 h-3 bg-white/60 rounded animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute inset-0 w-full h-full bg-black/20 hover:bg-black/30 transition-colors"
                  onClick={handleListen}
                >
                  {isTTSPlaying ? (
                    <Pause className="w-12 h-12 text-white" />
                  ) : (
                    <Play className="w-12 h-12 text-white" />
                  )}
                </Button>
              </div>
            </Card>

            {/* Course Modules */}
            <div className="space-y-4">
              {modules.map((module) => (
                <Card key={module.id} className="border-border bg-card">
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleModule(module.id)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold flex items-center gap-3 text-foreground">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSectionCompletion(module.id);
                          }}
                        >
                          {module.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-accent" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </Button>
                        {module.title}
                      </CardTitle>
                      {module.expanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  
                  {module.expanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Module Content */}
                        <div 
                          className={`p-4 rounded-lg transition-colors cursor-pointer ${
                            activeSection === module.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                          onClick={() => setActiveSection(module.id)}
                        >
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {module.content}
                          </p>
                        </div>

                        {/* Module Test */}
                        {module.test && (
                          <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-foreground">Module Test</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTakeTest(module.id, module.test)}
                              >
                                Take Test
                              </Button>
                            </div>
                            <div className="p-3 bg-muted/20 rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                Complete the test to mark this module as finished
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar - Mobile Friendly */}
          <div className="space-y-6 order-1 md:order-2">
            {/* Course Actions - Mobile Friendly */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base md:text-lg text-foreground">Course Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex flex-col sm:flex-row md:flex-col gap-2">
                <Button variant="outline" className="w-full justify-start" onClick={handleParaphrase}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="sm:hidden md:inline">Paraphrase</span>
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleExpatiate}>
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="sm:hidden md:inline">Expatiate</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleListen}
                  disabled={isTTSGenerating || isTTSPlaying}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  <span className="sm:hidden md:inline">
                    {isTTSGenerating ? "Generating..." : isTTSPlaying ? "Playing..." : "Listen"}
                  </span>
                </Button>
              </CardContent>
            </Card>

            {/* Progress Summary - Mobile Friendly */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base md:text-lg text-foreground">Progress Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium text-foreground">{Math.round(calculateProgress())}%</span>
                  </div>
                  
                  <Progress value={calculateProgress()} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="text-lg font-semibold text-accent">
                        {modules.filter(module => module.completed).length}
                      </div>
                      <div className="text-muted-foreground">Completed</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-muted-foreground">
                        {modules.length}
                      </div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Progress Summary - Fixed at bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground">{Math.round(calculateProgress())}%</div>
            <Progress value={calculateProgress()} className="h-2 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {modules.filter(module => module.completed).length}/{modules.length} Completed
            </span>
          </div>
        </div>
      </div>

      {/* Test Validation Modal */}
      <TestValidationModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        question={currentTest}
        onValidationComplete={handleTestValidation}
      />
    </div>
  );
}