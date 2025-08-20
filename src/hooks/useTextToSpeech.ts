import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useTextToSpeech() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  // Remove emojis/symbols and normalize text for better TTS pedagogy
  const sanitizeForSpeech = (raw: string): string => {
    if (!raw) return "";
    let text = raw
      // Remove emojis and pictographs
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, "")
      // Replace list markers with pauses
      .replace(/(^|\n)[\-•\*]\s+/g, "$1• ")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
    // Add brief pauses after bullets and headings
    text = text.replace(/•\s+/g, "• ");
    return text;
  };

  const splitIntoChunks = (text: string, maxLen = 800): string[] => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const s of sentences) {
      if ((current + (current ? " " : "") + s).length <= maxLen) {
        current = current ? current + " " + s : s;
      } else {
        if (current) chunks.push(current);
        if (s.length > maxLen) {
          // Hard split very long sentences
          for (let i = 0; i < s.length; i += maxLen) {
            chunks.push(s.slice(i, i + maxLen));
          }
          current = "";
        } else {
          current = s;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  const generateSpeech = async (text: string): Promise<string | null> => {
    setIsGenerating(true);
    
    try {
      console.log('Sending TTS request for text length:', text.length);
      console.log('Text preview:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      const response = await supabase.functions.invoke('text-to-speech', {
        body: {
          text
        }
      });

      console.log('TTS response received:', response);

      if (response.error) {
        console.error('TTS response error:', response.error);
        throw new Error(response.error.message || 'TTS generation failed');
      }

      // Expect success flag from edge function
      if (!response.data || response.data.success !== true) {
        const details = response.data?.details || 'Unknown error';
        const errorMsg = response.data?.error || 'TTS generation failed';
        console.error('TTS service returned failure:', { errorMsg, details });
        throw new Error(`${errorMsg}: ${details}`);
      }

      if (!response.data.audioContent) {
        console.error('TTS response missing audio content:', response);
        throw new Error('No audio content received from TTS service');
      }

      console.log('TTS audio content received, length:', response.data.audioContent.length);
      return response.data.audioContent;
    } catch (error) {
      console.error('TTS generation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
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
      // Wait for playback to end
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audio.src);
          resolve();
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audio.src);
          reject(new Error("Playback error"));
        };
      });
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
    const clean = sanitizeForSpeech(text);
    if (!clean) return;
    const chunks = splitIntoChunks(clean);
    for (const chunk of chunks) {
      const audioContent = await generateSpeech(chunk);
      if (!audioContent) break;
      await playAudio(audioContent);
    } else {
      // Fallback to browser speech if no audio content
      toast({
        title: "Using Browser Speech",
        description: "External TTS service unavailable, using browser speech synthesis.",
      });
      useBrowserSpeech(text);
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