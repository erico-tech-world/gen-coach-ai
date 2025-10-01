import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useRealtimeTTS } from "./useRealtimeTTS";

export function useTextToSpeech() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  const { languagePreference } = useProfile();

  // Integrate with RealtimeTTS system
  const realtimeTTS = useRealtimeTTS();

  // Remove emojis/symbols and normalize text for better TTS pedagogy
  const sanitizeForSpeech = (raw: string): string => {
    if (!raw) return "";
    let text = raw
      // Remove emojis and pictographs
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, "")
      // Replace list markers with pauses
      .replace(/(^|\n)[-•*]\s+/g, "$1• ")
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

  // Map language codes to Groq TTS supported languages
  const getGroqLanguageCode = (language: string): string => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'fr': 'fr-FR',
      'pcm': 'en-US', // Pidgin not supported by Groq, fallback to English
      'ig': 'en-US',  // Igbo not supported by Groq, fallback to English
    };
    return languageMap[language] || 'en-US';
  };

  // Check if language is supported by Groq TTS
  const isGroqSupported = (language: string): boolean => {
    const supportedLanguages = ['en', 'fr'];
    return supportedLanguages.includes(language);
  };

  const generateSpeech = async (text: string, language?: string): Promise<string | null> => {
    setIsGenerating(true);
    
    try {
      const targetLanguage = language || languagePreference || 'en';
      const groqLanguageCode = getGroqLanguageCode(targetLanguage);
      
      console.log('Sending TTS request for text length:', text.length, 'Language:', targetLanguage);
      console.log('Text preview:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      // Try Groq TTS first if language is supported
      if (isGroqSupported(targetLanguage)) {
        const response = await supabase.functions.invoke('text-to-speech', {
          body: {
            text,
            language: groqLanguageCode
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
      } else {
        // Use fallback TTS for unsupported languages
        console.log('Language not supported by Groq, using fallback TTS');
        const response = await supabase.functions.invoke('fallback-tts', {
          body: {
            text,
            language: targetLanguage
          }
        });

        if (response.error) {
          console.error('Fallback TTS response error:', response.error);
          throw new Error(response.error.message || 'Fallback TTS generation failed');
        }

        if (!response.data || response.data.success !== true) {
          const details = response.data?.details || 'Unknown error';
          const errorMsg = response.data?.error || 'Fallback TTS generation failed';
          console.error('Fallback TTS service returned failure:', { errorMsg, details });
          throw new Error(`${errorMsg}: ${details}`);
        }

        if (!response.data.audioContent) {
          console.error('Fallback TTS response missing audio content:', response);
          throw new Error('No audio content received from fallback TTS service');
        }

        console.log('Fallback TTS audio content received, length:', response.data.audioContent.length);
        return response.data.audioContent;
      }
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
      
      // Validate base64 string
      if (!base64Audio || typeof base64Audio !== 'string') {
        throw new Error('Invalid audio data received');
      }
      
      // Clean the base64 string (remove any whitespace or newlines)
      const cleanBase64 = base64Audio.trim().replace(/\s/g, '');
      
      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
        throw new Error('Invalid base64 format');
      }
      
      // Convert base64 to blob with error handling
      let byteCharacters;
      try {
        byteCharacters = atob(cleanBase64);
      } catch (error) {
        console.error('Base64 decode error:', error);
        throw new Error('Failed to decode audio data');
      }
      
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
      
      // If audio playback fails, fall back to browser TTS
      toast({
        title: "Audio Playback Failed",
        description: "Falling back to browser text-to-speech.",
        variant: "destructive"
      });
      
      // Don't throw error, let the calling function handle fallback
      throw error;
    }
  };

  const browserSpeech = (text: string, language?: string) => {
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
    
    // Try to use a voice for the target language
    const targetLanguage = language || languagePreference || 'en';
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith(targetLanguage) && 
      (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Alex'))
    ) || voices.find(voice => voice.lang.startsWith(targetLanguage)) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
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

  const speak = async (text: string, language?: string) => {
    const clean = sanitizeForSpeech(text);
    if (!clean) return;
    
    try {
      // Use RealtimeTTS system as primary TTS
      console.log('Using RealtimeTTS system for speech generation');
      await realtimeTTS.speak(clean, language);
      
    } catch (error) {
      console.error('RealtimeTTS failed, falling back to browser speech:', error);
      
      // Fallback to browser speech if RealtimeTTS fails
      const targetLanguage = language || languagePreference || 'en';
      toast({
        title: "Fallback to Browser Speech",
        description: "Advanced TTS system unavailable, using browser speech synthesis.",
      });
      browserSpeech(clean, targetLanguage);
    }
  };

  return {
    generateSpeech,
    playAudio,
    speak,
    isGenerating,
    isPlaying,
    // Expose RealtimeTTS functions for advanced usage
    realtimeTTS: {
      speak: realtimeTTS.speak,
      stop: realtimeTTS.stop,
      pause: realtimeTTS.pause,
      resume: realtimeTTS.resume,
      currentModel: realtimeTTS.currentModel,
      queueLength: realtimeTTS.queueLength
    }
  };
}