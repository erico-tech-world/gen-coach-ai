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

      // Check if we should use browser fallback
      if (response.data?.useBrowserFallback) {
        console.log('Using browser speech synthesis fallback');
        return 'BROWSER_FALLBACK';
      }

      return response.data?.audioContent || null;
    } catch (error) {
      console.error('TTS generation error:', error);
      
      // If there's any error, suggest browser fallback
      console.log('TTS service failed, using browser fallback');
      return 'BROWSER_FALLBACK';
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

  const useBrowserSpeech = (text: string) => {
    if (!window.speechSynthesis) {
      toast({
        title: "Speech Not Supported",
        description: "Your browser doesn't support text-to-speech.",
        variant: "destructive"
      });
      return;
    }

    setIsPlaying(true);
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Alex'))
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onend = () => {
      setIsPlaying(false);
    };
    
    utterance.onerror = (event) => {
      setIsPlaying(false);
      console.error('Speech synthesis error:', event);
      toast({
        title: "Speech Error",
        description: "Failed to speak text. Please try again.",
        variant: "destructive"
      });
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const speak = async (text: string) => {
    // Limit text length for better performance
    const textToSpeak = text.length > 1000 ? text.substring(0, 1000) + "..." : text;
    
    const audioContent = await generateSpeech(textToSpeak);
    
    if (audioContent === 'BROWSER_FALLBACK') {
      // Use browser's built-in speech synthesis
      useBrowserSpeech(textToSpeak);
    } else if (audioContent) {
      // Use external TTS service audio
      await playAudio(audioContent);
    } else {
      // Fallback to browser speech if no audio content
      toast({
        title: "Using Browser Speech",
        description: "External TTS service unavailable, using browser speech synthesis.",
      });
      useBrowserSpeech(textToSpeak);
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