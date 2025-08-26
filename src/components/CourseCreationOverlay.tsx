import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, X, FileText, Lightbulb, Globe, AlertCircle } from "lucide-react";
import { useCourses } from "@/hooks/useCourses";
import { useAI } from "@/hooks/useAI";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CourseCreationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated?: (courseData: {
    title: string;
    topic?: string;
    additional_details?: string;
  }) => Promise<void>;
}

// File size constants
const MAX_INLINE_SIZE = 500 * 1024; // 500KB for inline processing (reduced from 1MB)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB maximum upload size

export function CourseCreationOverlay({ isOpen, onClose, onCourseCreated }: CourseCreationOverlayProps) {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentContent, setDocumentContent] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { createCourse } = useCourses();
  const { generateCourse, isGenerating: aiIsGenerating } = useAI();
  const { userName, languagePreference, updateProfile } = useProfile();
  const { toast } = useToast();
  const [language, setLanguage] = useState<string>("en");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize language from profile preference
  useEffect(() => {
    if (languagePreference) {
      setLanguage(languagePreference);
    }
  }, [languagePreference]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setDocumentContent("");
      setDocumentName("");
      setFileUrl(null);
      setFileSize(0);
      setUploadError(null);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // Enhanced file upload handler with size validation and storage integration
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setUploadError(null);
    setDocumentContent("");
    setFileUrl(null);
    setFileSize(0);

    // Check file size
    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadError(`File too large. Maximum size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setFileSize(file.size);

    try {
      if (file.size <= MAX_INLINE_SIZE) {
        // Small file: process inline
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // Truncate content if it's still too long for API payload (reduced to 200KB)
          const maxContentLength = 200 * 1024; // 200KB max content length
          const truncatedContent = content.length > maxContentLength ? 
            content.substring(0, maxContentLength) + "\n\n[Content truncated due to length. Full content available in uploaded file.]" : 
            content;
          
          setDocumentContent(truncatedContent);
          setDocumentName(file.name);
          setIsUploading(false);
          setUploadProgress(100);
          
          if (content.length > maxContentLength) {
            toast({
              title: "Large File Processed",
              description: `"${file.name}" uploaded. Content was truncated for processing.`,
            });
          } else {
            toast({
              title: "Document Uploaded",
              description: `"${file.name}" has been uploaded successfully.`,
            });
          }
        };
        
        reader.onerror = () => {
          throw new Error("Failed to read file content");
        };
        
        reader.readAsText(file);
      } else {
        // Large file: upload to Supabase Storage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not authenticated");
        }

        // Create unique filename
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `course-uploads/${user.id}/${timestamp}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(fileName);

        if (!urlData.publicUrl) {
          throw new Error("Failed to get file URL");
        }

        setFileUrl(urlData.publicUrl);
        setDocumentName(file.name);
        setIsUploading(false);
        setUploadProgress(100);

        toast({
          title: "Document Uploaded to Cloud",
          description: `"${file.name}" has been uploaded successfully and will be processed during course generation.`,
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      setIsUploading(false);
      setUploadProgress(0);
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Separate document removal handler
  const removeDocument = useCallback(() => {
    setDocumentContent("");
    setDocumentName("");
    setFileUrl(null);
    setFileSize(0);
    setUploadError(null);
    setUploadProgress(0);
    toast({
      title: "Document Removed",
      description: "Reference document has been removed.",
    });
  }, [toast]);

  // Handle upload button click - directly trigger file input
  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  }, [isUploading]);

  // Enhanced generation handler with file URL support
  const handleGenerateCourse = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || aiIsGenerating) return;

    setIsGenerating(true);
    
    // Show initial loading notification
    toast({
      title: "Creating Your Course",
      description: "This may take 1-2 minutes. Please be patient while we generate your personalized learning content.",
    });
    
    try {
      // Create a clean, user-friendly course title
      const cleanTitle = input.trim();
      
      // Create separate prompts: one for AI context (with file info) and one for user display
      let aiContextPrompt = cleanTitle;
      
      // Add document context for AI processing (hidden from user)
      if (documentContent) {
        aiContextPrompt += `\n\n[AI CONTEXT ONLY - DO NOT DISPLAY TO USER] Additional context from document "${documentName}":\n${documentContent}`;
        // Add a note for AI to use this context but not show it
        aiContextPrompt += `\n\nIMPORTANT: Use the document content above to enhance your course material, but NEVER display the document name, URL, or technical details to the user. Create a professional, clean course title and content.`;
      } else if (fileUrl) {
        aiContextPrompt += `\n\n[AI CONTEXT ONLY - DO NOT DISPLAY TO USER] Reference document available at: ${fileUrl}`;
        // Add a note for AI to use this context but not show it
        aiContextPrompt += `\n\nIMPORTANT: Use the reference document to enhance your course material, but NEVER display the file URL, technical details, or mention "reference document" to the user. Create a professional, clean course title and content.`;
      }
      
      // Add AI instruction to create clean titles
      aiContextPrompt += `\n\nINSTRUCTION: Generate a professional, concise course title that focuses on the main topic. Do not include phrases like "using the uploaded file", "reference document", file names, URLs, or any technical details. The title should be clean and user-friendly.`;
      
      console.log('Starting course generation...');
      console.log('AI Context Prompt (with file info):', aiContextPrompt);
      
      const result = await generateCourse(aiContextPrompt, userName, language, fileUrl, fileSize);
      
      if (result && result.courseId) {
        // Save language preference if it changed
        if (language !== languagePreference) {
          await updateProfile({ language_preference: language });
        }

        // The Edge Function already created the course in the database
        // We don't need to call createCourse again - this prevents duplicates
        if (onCourseCreated) {
          await onCourseCreated({
            title: result.title,
            topic: cleanTitle, // Use clean title without technical details
            additional_details: `AI Generated Course - Language: ${language}${fileUrl ? ` - Enhanced with uploaded document` : ''}`
          });
        }
        
        toast({
          title: "Course Created Successfully!",
          description: "Your AI-powered course is ready. You'll be redirected to view it.",
        });

        // Auto-refresh the page to show the new course
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({
          title: "Course Generation Failed",
          description: "Failed to create course. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Course creation error:', error);
      toast({
        title: "Course Creation Failed",
        description: "An error occurred while creating your course. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  }, [input, documentContent, documentName, fileUrl, fileSize, language, userName, languagePreference, generateCourse, updateProfile, onCourseCreated, toast, isGenerating, aiIsGenerating]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-floating border border-border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Create AI Course</h2>
              <p className="text-muted-foreground">Generate a personalized learning experience</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleGenerateCourse} className="space-y-6">
            {/* Language Selection */}
            <div className="space-y-2">
              <Label htmlFor="language" className="flex items-center gap-2 text-foreground">
                <Globe className="w-4 h-4" />
                Course Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="pcm">Pidgin</SelectItem>
                  <SelectItem value="ig">Igbo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Your course will be generated in the selected language
              </p>
            </div>

            {/* Topic Input */}
            <div className="space-y-2">
              <Label htmlFor="topic" className="flex items-center gap-2 text-foreground">
                <Lightbulb className="w-4 h-4" />
                What would you like to learn?
              </Label>
              <Textarea
                id="topic"
                placeholder="e.g., Introduction to Machine Learning, Advanced JavaScript Concepts, Business Strategy Fundamentals..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[100px] resize-none"
                required
                disabled={isGenerating || aiIsGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Be specific for better results. Include any particular aspects you want to focus on.
              </p>
            </div>

            {/* Enhanced Document Upload with Size Validation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground">
                <FileText className="w-4 h-4" />
                Upload Reference Document (Optional)
              </Label>
              
              {/* File Size Guidelines */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Files &lt;=1MB: Processed inline for immediate context</p>
                <p>• Files 1-5MB: Stored in cloud and processed during generation</p>
                <p>• Files &gt;5MB: Not supported</p>
              </div>

              {!documentContent && !fileUrl ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a document to provide additional context
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.doc,.docx,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="document-upload"
                    aria-label="Upload document"
                    disabled={isUploading}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isUploading}
                    type="button"
                    onClick={handleUploadClick}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Choose File"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{documentName}</span>
                        <p className="text-xs text-muted-foreground">
                          {fileSize > 0 ? `${(fileSize / 1024).toFixed(1)}KB` : ''}
                          {fileUrl ? ' (Cloud Storage)' : ' (Inline Processing)'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={removeDocument}
                      type="button"
                      disabled={isGenerating || aiIsGenerating}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">{uploadError}</span>
                </div>
              )}
            </div>

            {/* Tips */}
            <Card className="bg-muted border-border">
              <CardContent className="p-4">
                <h4 className="font-semibold text-foreground mb-2">💡 Tips for Better Results</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Be specific about your learning goals</li>
                  <li>• Include your current skill level</li>
                  <li>• Mention any specific topics or concepts you want to focus on</li>
                  <li>• Upload relevant documents for enhanced context</li>
                  <li>• Large documents are automatically stored in the cloud</li>
                </ul>
              </CardContent>
            </Card>

            {/* Submit Button - Only for Generation */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isGenerating || aiIsGenerating}
              >
                Cancel
              </Button>
            <Button
              type="submit"
                className="flex-1 bg-ai-gradient hover:shadow-neural-glow transition-all"
                disabled={isGenerating || aiIsGenerating || !input.trim() || isUploading}
            >
                {isGenerating || aiIsGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Course...
                </>
              ) : (
                <>
                    <Lightbulb className="w-4 h-4 mr-2" />
                  Generate AI Course
                </>
              )}
            </Button>
            </div>

            {(isGenerating || aiIsGenerating) && (
              <p className="text-sm text-muted-foreground text-center">
                This may take 1-2 minutes. Please be patient while we create your personalized course.
              </p>
            )}
          </form>
        </div>
            </div>
    </div>
  );
}