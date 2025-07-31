import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTextToSpeech() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  const generateSpeech = async (text: string): Promise<string | null> => {
    setIsGenerating(true);
    
    try {
      const response = await supabase.functions.invoke('text-to-speech', {
        body: {
          text
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data.audioContent;
    } catch (error) {
      console.error('TTS generation error:', error);
      toast({
        title: "Speech Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate speech. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = async (base64Audio: string) => {
    try {
      setIsPlaying(true);
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      
      // Create audio element and play
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audio.src);
        toast({
          title: "Playback Error",
          description: "Failed to play audio. Please try again.",
          variant: "destructive"
        });
      };
      
      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
      toast({
        title: "Playback Error",
        description: "Failed to play audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const speak = async (text: string) => {
    const audioContent = await generateSpeech(text);
    if (audioContent) {
      await playAudio(audioContent);
    }
  };

  return {
    generateSpeech,
    playAudio,
    speak,
    isGenerating,
    isPlaying
  };
}