import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TTSModel {
  id: string;
  name: string;
  priority: number;
  fallback: boolean;
  supportedLanguages: string[];
}

interface TTSRequest {
  id: string;
  text: string;
  language: string;
  priority: number;
  timestamp: number;
}

interface TTSResponse {
  success: boolean;
  audioData?: string;
  error?: string;
  modelUsed?: string;
}

export function useRealtimeTTS() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [queueLength, setQueueLength] = useState(0);
  
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<TTSRequest[]>([]);
  const circuitBreakerRef = useRef<{ failures: number; lastFailure: number; isOpen: boolean }>({
    failures: 0,
    lastFailure: 0,
    isOpen: false
  });

  // TTS Models Configuration
  const ttsModels: TTSModel[] = [
    {
      id: 'maskgct',
      name: 'MaskGCT (Real-time)',
      priority: 1,
      fallback: false,
      supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']
    },
    {
      id: 'vibevoice',
      name: 'VibeVoice (Long-form)',
      priority: 2,
      fallback: false,
      supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']
    },
    {
      id: 'chatterbox',
      name: 'Chatterbox (Expressive)',
      priority: 3,
      fallback: false,
      supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']
    },
    {
      id: 'melotts',
      name: 'MeloTTS (Multilingual)',
      priority: 4,
      fallback: false,
      supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tl', 'sw', 'yo', 'ig', 'ha', 'zu', 'xh', 'af', 'st', 'ts', 'tn', 'ss', 've', 'nr', 'nso', 'ts', 'st', 'zu', 'xh', 'af', 'st', 'ts', 'tn', 'ss', 've', 'nr', 'nso']
    },
    {
      id: 'groq',
      name: 'Groq TTS (Fallback)',
      priority: 5,
      fallback: true,
      supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']
    }
  ];

  // Circuit Breaker Logic
  const checkCircuitBreaker = useCallback(() => {
    const now = Date.now();
    const { failures, lastFailure, isOpen } = circuitBreakerRef.current;
    
    // Reset circuit breaker after 30 seconds
    if (isOpen && now - lastFailure > 30000) {
      circuitBreakerRef.current.isOpen = false;
      circuitBreakerRef.current.failures = 0;
      return false;
    }
    
    // Open circuit breaker after 5 consecutive failures
    if (failures >= 5) {
      circuitBreakerRef.current.isOpen = true;
      circuitBreakerRef.current.lastFailure = now;
      return true;
    }
    
    return false;
  }, []);

  const recordFailure = useCallback(() => {
    circuitBreakerRef.current.failures++;
    circuitBreakerRef.current.lastFailure = Date.now();
  }, []);

  const recordSuccess = useCallback(() => {
    circuitBreakerRef.current.failures = 0;
  }, []);

  // Token Bucket Rate Limiting
  const rateLimiterRef = useRef<{ tokens: number; lastRefill: number; maxTokens: number; refillRate: number }>({
    tokens: 10,
    lastRefill: Date.now(),
    maxTokens: 10,
    refillRate: 1000 // 1 token per second
  });

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const { tokens, lastRefill, maxTokens, refillRate } = rateLimiterRef.current;
    
    // Refill tokens
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor(timePassed / refillRate);
    const newTokens = Math.min(maxTokens, tokens + tokensToAdd);
    
    if (newTokens > tokens) {
      rateLimiterRef.current.tokens = newTokens;
      rateLimiterRef.current.lastRefill = now;
    }
    
    if (tokens < 1) {
      return false;
    }
    
    rateLimiterRef.current.tokens--;
    return true;
  }, []);

  // Queue Management
  const addToQueue = useCallback((request: TTSRequest) => {
    queueRef.current.push(request);
    queueRef.current.sort((a, b) => a.priority - b.priority);
    setQueueLength(queueRef.current.length);
  }, []);

  const removeFromQueue = useCallback((requestId: string) => {
    queueRef.current = queueRef.current.filter(req => req.id !== requestId);
    setQueueLength(queueRef.current.length);
  }, []);

  const getNextRequest = useCallback(() => {
    return queueRef.current.shift();
  }, []);

  // TTS Generation with Model Selection
  const generateTTS = useCallback(async (text: string, language: string = 'en'): Promise<TTSResponse> => {
    if (checkCircuitBreaker()) {
      return {
        success: false,
        error: 'TTS service temporarily unavailable due to high failure rate'
      };
    }

    if (!checkRateLimit()) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait before making another request.'
      };
    }

    // Find best available model for the language
    const availableModels = ttsModels
      .filter(model => model.supportedLanguages.includes(language))
      .sort((a, b) => a.priority - b.priority);

    if (availableModels.length === 0) {
      return {
        success: false,
        error: `Language '${language}' not supported by any TTS model`
      };
    }

    // Try models in priority order
    for (const model of availableModels) {
      try {
        setCurrentModel(model.name);
        
        let response: TTSResponse;
        
        switch (model.id) {
          case 'maskgct':
            response = await generateWithMaskGCT(text, language);
            break;
          case 'vibevoice':
            response = await generateWithVibeVoice(text, language);
            break;
          case 'chatterbox':
            response = await generateWithChatterbox(text, language);
            break;
          case 'melotts':
            response = await generateWithMeloTTS(text, language);
            break;
          case 'groq':
            response = await generateWithGroq(text, language);
            break;
          default:
            continue;
        }

        if (response.success) {
          recordSuccess();
          return { ...response, modelUsed: model.name };
        }
      } catch (error) {
        console.error(`TTS generation failed with ${model.name}:`, error);
        recordFailure();
        continue;
      }
    }

    return {
      success: false,
      error: 'All TTS models failed. Please try again later.'
    };
  }, []);

  // Individual TTS Model Implementations
  const generateWithMaskGCT = async (text: string, language: string): Promise<TTSResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('maskgct-tts', {
        body: { text, language }
      });

      if (error) throw error;

      return {
        success: true,
        audioData: data.audio
      };
    } catch (error) {
      throw new Error(`MaskGCT TTS failed: ${error}`);
    }
  };

  const generateWithVibeVoice = async (text: string, language: string): Promise<TTSResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('vibevoice-tts', {
        body: { text, language }
      });

      if (error) throw error;

      return {
        success: true,
        audioData: data.audio
      };
    } catch (error) {
      throw new Error(`VibeVoice TTS failed: ${error}`);
    }
  };

  const generateWithChatterbox = async (text: string, language: string): Promise<TTSResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('chatterbox-tts', {
        body: { text, language }
      });

      if (error) throw error;

      return {
        success: true,
        audioData: data.audio
      };
    } catch (error) {
      throw new Error(`Chatterbox TTS failed: ${error}`);
    }
  };

  const generateWithMeloTTS = async (text: string, language: string): Promise<TTSResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('melotts-tts', {
        body: { text, language }
      });

      if (error) throw error;

      return {
        success: true,
        audioData: data.audio
      };
    } catch (error) {
      throw new Error(`MeloTTS failed: ${error}`);
    }
  };

  const generateWithGroq = async (text: string, language: string): Promise<TTSResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, language }
      });

      if (error) throw error;

      return {
        success: true,
        audioData: data.audio
      };
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  };

  // Main TTS Function
  const speak = useCallback(async (text: string, language: string = 'en'): Promise<void> => {
    if (!text || text.trim().length === 0) {
      toast({
        title: "No Text",
        description: "Please provide text to convert to speech.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Add to queue
      const request: TTSRequest = {
        id: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        language,
        priority: 1,
        timestamp: Date.now()
      };

      addToQueue(request);

      // Generate TTS
      const response = await generateTTS(text, language);
      
      if (response.success && response.audioData) {
        // Play audio
        await playAudio(response.audioData);
        
        toast({
          title: "Speech Generated",
          description: `Using ${response.modelUsed}`,
        });
      } else {
        throw new Error(response.error || 'TTS generation failed');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      toast({
        title: "TTS Generation Failed",
        description: error instanceof Error ? error.message : 'Failed to generate speech',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      // Ensure queue cleanup even if errors occur
      try {
        // Attempt to remove the most recent request if available
        const queued = queueRef.current[0];
        if (queued) {
          removeFromQueue(queued.id);
        }
      } catch {}
    }
  }, [toast, addToQueue, removeFromQueue, generateTTS]);

  // Audio Playback
  const playAudio = useCallback(async (audioData: string): Promise<void> => {
    try {
      // Create audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      
      // Set audio source
      if (audioData.startsWith('data:audio/')) {
        audio.src = audioData;
      } else {
        audio.src = `data:audio/mp3;base64,${audioData}`;
      }

      // Play audio
      setIsPlaying(true);
      await audio.play();

      // Handle audio events
      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        throw new Error('Audio playback failed');
      };

    } catch (error) {
      setIsPlaying(false);
      throw new Error(`Audio playback error: ${error}`);
    }
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  // Resume playback
  const resume = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to resume audio:', error);
      }
    }
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isGenerating,
    isPlaying,
    currentModel,
    queueLength,
    generateTTS
  };
}
