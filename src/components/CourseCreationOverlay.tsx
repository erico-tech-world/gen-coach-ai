import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, X, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCourses } from "@/hooks/useCourses";
import { useAI } from "@/hooks/useAI";
import { useProfile } from "@/hooks/useProfile";
import { VoiceInput } from "@/components/VoiceInput";
import { DocumentUpload } from "@/components/DocumentUpload";

interface CourseCreationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CourseCreationOverlay({ isOpen, onClose }: CourseCreationOverlayProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentContent, setDocumentContent] = useState("");
  const [documentName, setDocumentName] = useState("");
  const { createCourse } = useCourses();
  const { generateCourse, isGenerating } = useAI();
  const { userName } = useProfile();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    
    try {
      const enhancedPrompt = documentContent 
        ? `${input.trim()}\n\nAdditional context from document "${documentName}":\n${documentContent}`
        : input.trim();
      
      console.log('Starting course generation...');
      const result = await generateCourse(enhancedPrompt, userName);
      
      if (result) {
        if (result.courseId) {
          // Course was saved to database by the edge function
          toast({
            title: "AI Course Generated!",
            description: "Your personalized course has been created with AI assistance.",
          });
        } else {
          // Fallback: save manually if edge function didn't save
          console.log('Saving course manually...');
          await createCourse({
            title: result.title,
            topic: input.trim(),
            modules: result.modules,
            additional_details: `AI Generated Course - YouTube Links: ${JSON.stringify(result.youtubeLinks)}, Wikipedia: ${JSON.stringify(result.wikipediaData)}`
          });
          
          toast({
            title: "AI Course Generated!",
            description: "Your personalized course has been created successfully.",
          });
        }
        
        setInput("");
        setDocumentContent("");
        setDocumentName("");
        // Auto-refresh course list by refetching and closing overlay
        await new Promise((r) => setTimeout(r, 300));
        window.location.reload();
        onClose();
      }
    } catch (error) {
      console.error('Course creation error:', error);
      
      // Fallback to basic course creation
      try {
        console.log('Attempting fallback course creation...');
        await createCourse({
          title: input.trim(),
          topic: input.trim(),
          modules: [
            {
              id: crypto.randomUUID(),
              title: "Introduction",
              content: "This is a basic course introduction. AI features may need proper configuration.",
              test: "1. What is this course about?\na) " + input.trim() + "\nb) Something else\nc) Unknown\nd) None\nAnswer: a",
              completed: false
            }
          ],
          additional_details: "Basic course - AI generation failed"
        });
        
        toast({
          title: "Basic Course Created",
          description: "Course created successfully. AI features may need API configuration.",
        });
        
        setInput("");
        onClose();
      } catch (fallbackError) {
        console.error('Fallback course creation failed:', fallbackError);
        toast({
          title: "Error",
          description: "Failed to create course. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setInput(transcript);
  };

  const handleDocumentProcessed = (content: string, filename: string) => {
    setDocumentContent(content);
    setDocumentName(filename);
  };

  if (!isOpen) return null;

  const isProcessing = isLoading || isGenerating;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-floating border-border animate-in zoom-in-95 duration-300">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ai-gradient flex items-center justify-center shadow-neural-glow">
                <img src="/GenCoachImg.png" alt="GEN-COACH Logo" className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Create GEN-COACH Course</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" disabled={isProcessing}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <DocumentUpload onDocumentProcessed={handleDocumentProcessed} />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <FileText className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                type="text"
                placeholder="e.g., 'Teach me linear algebra'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 pl-10 pr-12 bg-input border-border text-foreground placeholder:text-muted-foreground"
                disabled={isProcessing}
                required
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <VoiceInput 
                  onTranscript={handleVoiceTranscript}
                  disabled={isProcessing}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-ai-gradient hover:shadow-neural-glow transition-all duration-300"
              disabled={!input.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating AI Course...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Course
                </>
              )}
            </Button>
            {isProcessing ? (
              <p className="text-xs text-muted-foreground text-center">
                This may take 1–2 minutes. Please keep this window open while we generate your course.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Tip: Generation can take 1–2 minutes depending on topic complexity.
              </p>
            )}
          </form>

          {documentContent && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Document "{documentName}" will be used to enhance course generation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}