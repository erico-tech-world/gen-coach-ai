import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AIAvatarContainerProps {
  courseId: string;
  courseTitle: string;
  content: string;
  language?: string;
}

interface TTSSession {
  id: string;
  currentPosition: number;
  isPaused: boolean;
  sessionData: any;
}

export function AIAvatarContainer({ courseId, courseTitle, content, language = 'en' }: AIAvatarContainerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [subtitles, setSubtitles] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { speak, isGenerating, isPlaying: isTTSPlaying } = useTextToSpeech();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<TTSSession | null>(null);

  // Load or create TTS session on component mount
  useEffect(() => {
    loadOrCreateSession();
  }, [courseId]);

  // Save session state periodically
  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(() => {
        saveSessionState();
      }, 5000); // Save every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [sessionId, currentPosition, isPaused]);

  // Load existing session or create new one
  const loadOrCreateSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to load existing session
      const { data: existingSession } = await supabase
        .from('tts_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (existingSession) {
        sessionRef.current = existingSession;
        setSessionId(existingSession.id);
        setCurrentPosition(existingSession.current_position || 0);
        setIsPaused(existingSession.is_paused || false);
        
        // Resume from last position if not paused
        if (!existingSession.is_paused && existingSession.current_position > 0) {
          toast({
            title: "Session Resumed",
            description: `Continuing from where you left off.`,
          });
        }
      } else {
        // Create new session
        const { data: newSession } = await supabase
          .from('tts_sessions')
          .insert({
            user_id: user.id,
            course_id: courseId,
            session_data: { content, language },
            current_position: 0,
            is_paused: false
          })
          .select()
          .single();

        if (newSession) {
          sessionRef.current = newSession;
          setSessionId(newSession.id);
        }
      }
    } catch (error) {
      console.error('Error loading TTS session:', error);
    }
  };

  // Save current session state
  const saveSessionState = async () => {
    if (!sessionId || !sessionRef.current) return;

    try {
      await supabase
        .from('tts_sessions')
        .update({
          current_position: currentPosition,
          is_paused: isPaused,
          session_data: { content, language, subtitles }
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error saving session state:', error);
    }
  };

  // Generate subtitles from content
  const generateSubtitles = useCallback((text: string): string[] => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.filter(sentence => sentence.trim().length > 0);
  }, []);

  // Start narration
  const handleStart = async () => {
    if (!content) {
      toast({
        title: "No Content",
        description: "No content available to narrate.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setIsPaused(false);
    setCurrentPosition(0);
    
    try {
      // Generate subtitles
      const newSubtitles = generateSubtitles(content);
      setSubtitles(newSubtitles);
      
      // Start TTS
      await speak(content, language);
      setIsPlaying(true);
      
      // Update session
      if (sessionRef.current) {
        sessionRef.current.is_paused = false;
        sessionRef.current.current_position = 0;
      }
      
      toast({
        title: "Narration Started",
        description: "AI is now narrating your course content.",
      });
    } catch (error) {
      console.error('Error starting narration:', error);
      toast({
        title: "Narration Failed",
        description: "Failed to start narration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pause narration
  const handlePause = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
    
    // Update session
    if (sessionRef.current) {
      sessionRef.current.is_paused = true;
      sessionRef.current.current_position = currentPosition;
    }
    
    toast({
      title: "Narration Paused",
      description: "Narration has been paused. Click Continue to resume.",
    });
  };

  // Continue narration
  const handleContinue = async () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
    setIsPaused(false);
    setIsPlaying(true);
    
    // Update session
    if (sessionRef.current) {
      sessionRef.current.is_paused = false;
    }
    
    toast({
      title: "Narration Resumed",
      description: "Continuing narration from where you left off.",
    });
  };

  // Restart narration
  const handleRestart = async () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setIsPaused(false);
    setIsPlaying(false);
    setCurrentPosition(0);
    
    // Update session
    if (sessionRef.current) {
      sessionRef.current.is_paused = false;
      sessionRef.current.current_position = 0;
    }
    
    // Start fresh
    await handleStart();
  };

  // Update current subtitle based on TTS progress
  useEffect(() => {
    if (isTTSPlaying && subtitles.length > 0) {
      const interval = setInterval(() => {
        setCurrentPosition(prev => {
          const newPosition = Math.min(prev + 1, subtitles.length - 1);
          setCurrentSubtitle(subtitles[newPosition] || '');
          return newPosition;
        });
      }, 2000); // Update subtitle every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [isTTSPlaying, subtitles]);

  // Handle TTS completion
  useEffect(() => {
    if (!isTTSPlaying && isPlaying) {
      setIsPlaying(false);
      setCurrentPosition(subtitles.length - 1);
      setCurrentSubtitle(subtitles[subtitles.length - 1] || '');
      
      toast({
        title: "Narration Complete",
        description: "Course narration has finished.",
      });
    }
  }, [isTTSPlaying, isPlaying, subtitles]);

  return (
    <Card className="w-full shadow-floating border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-foreground">
          <div className="w-12 h-12 bg-ai-gradient rounded-full flex items-center justify-center shadow-neural-glow">
            <img 
              src="/GenCoachAvatar.png" 
              alt="GEN-COACH AI Avatar" 
              className="w-10 h-10 rounded-full"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg hidden">
              GC
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Course Narrator</h3>
            <p className="text-sm text-muted-foreground">Listen to your course content</p>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Volume Indicator */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 bg-ai-gradient rounded-full flex items-center justify-center relative">
            <Volume2 className="w-8 h-8 text-white" />
            {isPlaying && !isPaused && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className="w-1 h-3 bg-white/60 rounded animate-pulse" 
                      style={{ animationDelay: `${i * 0.1}s` }} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3">
          {!isPlaying && !isPaused && (
            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="bg-ai-gradient hover:shadow-neural-glow transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start
            </Button>
          )}
          
          {isPlaying && !isPaused && (
            <Button
              onClick={handlePause}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          
          {isPaused && (
            <Button
              onClick={handleContinue}
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
            >
              <Play className="w-4 h-4 mr-2" />
              Continue
            </Button>
          )}
          
          {(isPlaying || isPaused) && (
            <Button
              onClick={handleRestart}
              variant="outline"
              className="border-muted-foreground text-muted-foreground hover:bg-muted/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          )}
        </div>

        {/* Progress Indicator */}
        {subtitles.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{currentPosition + 1} / {subtitles.length}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-ai-gradient h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentPosition + 1) / subtitles.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Subtitles with Real-time Captions */}
        <div className="min-h-[120px] max-h-[200px] overflow-y-auto">
          <div className="space-y-3">
            {subtitles.map((subtitle, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg transition-all duration-500 ease-in-out ${
                  index === currentPosition
                    ? 'bg-primary/10 border border-primary/20 text-primary transform scale-105 shadow-lg'
                    : index < currentPosition
                    ? 'bg-muted/30 text-muted-foreground opacity-80'
                    : 'bg-muted/10 text-muted-foreground/60 opacity-40'
                }`}
              >
                <p className="text-sm leading-relaxed break-words">
                  {subtitle}
                </p>
                {index === currentPosition && isPlaying && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs text-primary font-medium">Speaking...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Real-time Caption Display */}
          {isPlaying && currentSubtitle && (
            <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs font-medium text-primary">Live Caption</span>
              </div>
              <div className="text-sm text-foreground leading-relaxed break-words">
                {currentSubtitle}
              </div>
            </div>
          )}
          
          {subtitles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click Start to begin narration</p>
            </div>
          )}
        </div>

        {/* Session Status */}
        {sessionId && (
          <div className="text-xs text-muted-foreground text-center">
            Session saved • {isPaused ? 'Paused' : isPlaying ? 'Playing' : 'Ready'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
