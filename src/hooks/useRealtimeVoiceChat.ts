import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Memory management interface
interface MemoryManager {
  addMessage: (message: { role: 'user' | 'assistant'; content: string; metadata?: Record<string, unknown> }) => Promise<void>;
  getConversationContext: (maxMessages?: number) => string;
  updateSessionMetadata: (metadata: Record<string, unknown>) => Promise<void>;
}

// Memory manager instance
let memoryManager: MemoryManager | null = null;

// Set memory manager from external component
export const setMemoryManager = (manager: MemoryManager) => {
  memoryManager = manager;
};

interface VoiceChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useRealtimeVoiceChat() {
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const { toast } = useToast();
  
  const recognitionRef = useRef<typeof SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const connect = useCallback(async () => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      // Show connecting state
      toast({
        title: "Connecting...",
        description: "Initializing voice chat capabilities...",
      });

      // Create new recognition instance
      recognitionRef.current = new SpeechRecognition();
      synthRef.current = window.speechSynthesis;
      
      // Configure recognition settings
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      // Set up recognition event handlers BEFORE setting connected state
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
      };
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setCurrentTranscript(transcript);
        
        // Add user message to chat
        const userMessage: VoiceChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: transcript,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        
        // Add to memory if manager is available
        if (memoryManager) {
          memoryManager.addMessage({
            role: 'user',
            content: transcript,
            metadata: { context: 'voice_input' }
          });
        }
        
        // Process AI response using the actual AI service
        handleAIResponse(transcript);
      };
      
      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast({
            title: "Voice Recognition Error",
            description: `Error: ${event.error}. Please try again.`,
            variant: "destructive"
          });
        }
        // Don't disconnect on error - let user try again
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        // Don't disconnect here - let user continue using voice chat
        // Only restart recognition if user wants to speak again
        setIsRecording(false);
      };
      
      // Set connected state AFTER setting up all handlers
      setIsConnected(true);
      console.log('✅ Voice chat connected successfully');
      
      // Success notification
      toast({
        title: "Voice Chat Connected! 🎉",
        description: "You can now speak with the AI. Click the microphone to start recording.",
      });
      
      // Add welcome message
      const welcomeMessage: VoiceChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm your AI voice assistant. I'm ready to help you with any questions or tasks. You can speak to me or type your messages.",
        timestamp: new Date()
      };
      
      setMessages(prev => [welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to connect to voice chat:', error);
      // Reset connection state on error
      setIsConnected(false);
      toast({
        title: "Connection Failed",
        description: "Could not initialize voice chat. Please ensure microphone access is allowed and try again.",
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting voice chat...');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    setCurrentTranscript('');
    
    // Clear messages when disconnecting
    setMessages([]);
    console.log('🔌 Voice chat disconnected');
  }, []);

  const handleAIResponse = useCallback(async (userMessage: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('realtime-voice-chat', {
        body: {
          message: userMessage,
          userName: user.user_metadata?.name || user.email,
          conversationHistory: messages.slice(-5).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }
      });

      if (error) {
        throw new Error(`Voice chat error: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to get AI response');
      }

      const aiResponse = data.response;
      
      // Clean up the AI response to remove technical references and improve user experience
      const cleanAIResponse = cleanAIResponseContent(aiResponse);
      
      // Add AI message to chat
      const aiMessage: VoiceChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: cleanAIResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Speak the cleaned AI response
      speakText(cleanAIResponse);
      
    } catch (error) {
      console.error('AI response error:', error);
      toast({
        title: "AI Response Error",
        description: "Failed to get response from AI. Please try again.",
        variant: "destructive"
      });
    }
  }, [messages, toast]);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    // Clean text for speech synthesis (remove symbols, emojis, etc.)
    const cleanText = text
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, '')
      .replace(/[^\w\s.,!?-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a good voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Alex'))
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentTranscript('');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentTranscript('');
      console.error('Speech synthesis error');
    };
    
    synthRef.current.speak(utterance);
  }, []);

  // Function to clean AI response content for better user experience
  const cleanAIResponseContent = useCallback((response: string): string => {
    if (!response) return '';
    
    let cleanResponse = response;
    
    // Remove technical references and file information
    cleanResponse = cleanResponse
      .replace(/\[AI CONTEXT ONLY.*?\]/g, '') // Remove AI context markers
      .replace(/using the uploaded file/gi, '')
      .replace(/reference document/gi, '')
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/file:\s*[^\s]+/gi, '') // Remove file references
      .replace(/storage\.objects/gi, '')
      .replace(/bucket_id/gi, '')
      .replace(/user-uploads/gi, '')
      .replace(/course-uploads/gi, '')
      .replace(/\[.*?\]/g, '') // Remove any remaining brackets
      .replace(/\s+/g, ' ') // Clean up extra whitespace
      .trim();
    
    // Remove raw text formats and technical context
    cleanResponse = cleanResponse
      .replace(/raw text format/gi, '')
      .replace(/technical context/gi, '')
      .replace(/file content/gi, '')
      .replace(/document content/gi, '')
      .replace(/uploaded content/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Ensure the response starts with a proper sentence
    if (cleanResponse && !cleanResponse.match(/^[A-Z]/)) {
      cleanResponse = cleanResponse.charAt(0).toUpperCase() + cleanResponse.slice(1);
    }
    
    return cleanResponse;
  }, []);

  const startRecording = useCallback(() => {
    if (!isConnected || !recognitionRef.current) {
      toast({
        title: "Not Connected",
        description: "Please connect to voice chat first.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsRecording(true);
      setCurrentTranscript('');
      
      // Start recognition
      recognitionRef.current.start();
      
      toast({
        title: "Recording Started",
        description: "Speak now...",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      toast({
        title: "Recording Failed",
        description: "Could not start recording. Please try again.",
        variant: "destructive"
      });
    }
  }, [isConnected, toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    // Add user message
    const userMessage: VoiceChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Send to AI and get response
    await handleAIResponse(text.trim());
  }, [handleAIResponse]);

  return {
    messages,
    isConnected,
    isRecording,
    isSpeaking,
    currentTranscript,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage
  };
}