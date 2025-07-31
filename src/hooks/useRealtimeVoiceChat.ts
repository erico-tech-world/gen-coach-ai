import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const connect = useCallback(async () => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      recognitionRef.current = new SpeechRecognition();
      synthRef.current = window.speechSynthesis;
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      setIsConnected(true);
      toast({
        title: "Voice chat connected",
        description: "You can now speak with the AI using DeepSeek!",
      });
    } catch (error) {
      console.error('Failed to connect to voice chat:', error);
      toast({
        title: "Connection failed",
        description: "Could not initialize voice chat. Please ensure microphone access is allowed.",
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const disconnect = useCallback(() => {
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
  }, []);

  const handleAIResponse = useCallback(async (userMessage: string) => {
    try {
      setCurrentTranscript('AI is thinking...');
      
      console.log('Sending message to AI:', userMessage);
      
      const { data, error } = await supabase.functions.invoke('realtime-voice-chat', {
        body: { message: userMessage }
      });

      console.log('Supabase function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`AI service error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from AI service');
      }

      if (!data.response) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format from AI service');
      }

      const aiResponse = data.response;
      
      // Add AI message
      const assistantMessage: VoiceChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the response
      setCurrentTranscript(aiResponse);
      speakText(aiResponse);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setCurrentTranscript('');
      
      let errorMessage = 'Failed to get response from AI. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "AI Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [toast]);

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return;
    
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
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

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || !isConnected) return;
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Speech recognized:', transcript);
      
      // Add user message
      const userMessage: VoiceChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Send to AI and get response
      handleAIResponse(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      toast({
        title: "Recording Error",
        description: `Speech recognition failed: ${event.error}. Please try again.`,
        variant: "destructive"
      });
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };

    try {
      recognitionRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Listening...",
        description: "Speak now, I'll respond when you're done.",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive"
      });
    }
  }, [isConnected, handleAIResponse, toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    
    const userMessage: VoiceChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    handleAIResponse(text);
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