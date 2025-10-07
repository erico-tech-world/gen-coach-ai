import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    courseId?: string;
    moduleId?: string;
    context?: string;
  };
}

interface ChatSession {
  id: string;
  userId: string;
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  // Keep metadata in-memory only to match DB schema without metadata column
  metadata?: {
    courseId?: string;
    courseTitle?: string;
    currentModule?: string;
    context?: string;
  };
}

export function useAIVoiceChatMemory() {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [memoryBuffer, setMemoryBuffer] = useState<ChatMessage[]>([]);
  
  const { toast } = useToast();
  const sessionRef = useRef<ChatSession | null>(null);
  const memoryBufferRef = useRef<ChatMessage[]>([]);

  // Initialize or load existing session
  useEffect(() => {
    initializeSession();
  }, []);

  // Initialize a new chat session or load existing one
  const initializeSession = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate a unique session ID
      const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Try to load existing session from database
      const { data: existingSession } = await supabase
        .from('ai_chat_memory')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single();

      if (existingSession) {
        const session: ChatSession = {
          id: existingSession.id,
          userId: existingSession.user_id,
          sessionId: existingSession.session_id,
          messages: existingSession.messages || [],
          createdAt: new Date(existingSession.created_at).getTime(),
          updatedAt: new Date(existingSession.updated_at).getTime(),
          metadata: {} // in-memory only
        };
        
        setCurrentSession(session);
        sessionRef.current = session;
        setMemoryBuffer(session.messages.slice(-10)); // Keep last 10 messages in memory
        memoryBufferRef.current = session.messages.slice(-10);
      } else {
        // Create new session
        const newSession: ChatSession = {
          id: '',
          userId: user.id,
          sessionId,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {}
        };
        
        setCurrentSession(newSession);
        sessionRef.current = newSession;
        setMemoryBuffer([]);
        memoryBufferRef.current = [];
      }
    } catch (error) {
      console.error('Error initializing chat session:', error);
    }
  }, []);

  // Add message to memory buffer and session
  const addMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    try {
      const newMessage: ChatMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      // Add to memory buffer (keep last 10 messages)
      const updatedBuffer = [...memoryBufferRef.current, newMessage].slice(-10);
      setMemoryBuffer(updatedBuffer);
      memoryBufferRef.current = updatedBuffer;

      // Add to session
      if (sessionRef.current) {
        const updatedSession = {
          ...sessionRef.current,
          messages: [...sessionRef.current.messages, newMessage],
          updatedAt: Date.now()
        };
        
        setCurrentSession(updatedSession);
        sessionRef.current = updatedSession;

        // Save to database
        await saveSessionToDatabase(updatedSession);
      }
    } catch (error) {
      console.error('Error adding message to memory:', error);
    }
  }, []);

  // Save session to database
  const saveSessionToDatabase = useCallback(async (session: ChatSession) => {
    try {
      if (!session.id) {
        // Create new session in database
        const { data: newSession, error } = await supabase
          .from('ai_chat_memory')
          .insert({
            user_id: session.userId,
            session_id: session.sessionId,
            messages: session.messages
          })
          .select()
          .single();

        if (error) throw error;

        // Update local session with database ID
        const updatedSession = { ...session, id: newSession.id };
        setCurrentSession(updatedSession);
        sessionRef.current = updatedSession;
      } else {
        // Update existing session
        const { error } = await supabase
          .from('ai_chat_memory')
          .update({
            messages: session.messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving session to database:', error);
      toast({
        title: "Memory Save Failed",
        description: "Failed to save chat memory. Your conversation may not persist.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Get conversation context for AI
  const getConversationContext = useCallback((maxMessages: number = 10): string => {
    if (!memoryBufferRef.current.length) {
      return '';
    }

    // Get the last N messages
    const recentMessages = memoryBufferRef.current.slice(-maxMessages);
    
    // Format context for AI
    const context = recentMessages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.content}`;
    }).join('\n\n');

    return context;
  }, []);

  // Get conversation summary
  const getConversationSummary = useCallback((): string => {
    if (!memoryBufferRef.current.length) {
      return 'No previous conversation context.';
    }

    const userMessages = memoryBufferRef.current.filter(msg => msg.role === 'user');
    const assistantMessages = memoryBufferRef.current.filter(msg => msg.role === 'assistant');

    let summary = `Previous conversation context:\n`;
    
    if (userMessages.length > 0) {
      summary += `- User has asked ${userMessages.length} question(s)\n`;
      summary += `- Last user question: "${userMessages[userMessages.length - 1].content}"\n`;
    }
    
    if (assistantMessages.length > 0) {
      summary += `- Assistant has provided ${assistantMessages.length} response(s)\n`;
      summary += `- Last assistant response: "${assistantMessages[assistantMessages.length - 1].content}"\n`;
    }

    return summary;
  }, []);

  // Update session metadata (kept in-memory only)
  const updateSessionMetadata = useCallback(async (metadata: Partial<ChatSession['metadata']>) => {
    if (!sessionRef.current) return;

    const updatedSession = {
      ...sessionRef.current,
      metadata: { ...sessionRef.current.metadata, ...metadata },
      updatedAt: Date.now()
    };

    setCurrentSession(updatedSession);
    sessionRef.current = updatedSession;

    // Save to database (messages only)
    await saveSessionToDatabase(updatedSession);
  }, [saveSessionToDatabase]);

  // Clear current session
  const clearSession = useCallback(async () => {
    try {
      if (sessionRef.current?.id) {
        // Delete from database
        await supabase
          .from('ai_chat_memory')
          .delete()
          .eq('id', sessionRef.current.id);
      }

      // Reset local state
      setCurrentSession(null);
      sessionRef.current = null;
      setMemoryBuffer([]);
      memoryBufferRef.current = [];

      toast({
        title: "Session Cleared",
        description: "Chat memory has been cleared.",
      });
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }, [toast]);

  // Load specific session by ID
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessionData, error } = await supabase
        .from('ai_chat_memory')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      const session: ChatSession = {
        id: sessionData.id,
        userId: sessionData.user_id,
        sessionId: sessionData.session_id,
        messages: sessionData.messages || [],
        createdAt: new Date(sessionData.created_at).getTime(),
        updatedAt: new Date(sessionData.updated_at).getTime(),
        metadata: {}
      };

      setCurrentSession(session);
      sessionRef.current = session;
      setMemoryBuffer(session.messages.slice(-10));
      memoryBufferRef.current = session.messages.slice(-10);

      toast({
        title: "Session Loaded",
        description: `Loaded conversation with ${session.messages.length} messages.`,
      });
    } catch (error) {
      console.error('Error loading session:', error);
      toast({
        title: "Session Load Failed",
        description: "Failed to load the selected conversation.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Get all user sessions
  const getUserSessions = useCallback(async (): Promise<ChatSession[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: sessions, error } = await supabase
        .from('ai_chat_memory')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return sessions.map(session => ({
        id: session.id,
        userId: session.user_id,
        sessionId: session.session_id,
        messages: session.messages || [],
        createdAt: new Date(session.created_at).getTime(),
        updatedAt: new Date(session.updated_at).getTime(),
        metadata: {}
      }));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }, []);

  // Search messages in current session
  const searchMessages = useCallback((query: string): ChatMessage[] => {
    if (!memoryBufferRef.current.length) return [];

    const lowercaseQuery = query.toLowerCase();
    return memoryBufferRef.current.filter(msg => 
      msg.content.toLowerCase().includes(lowercaseQuery)
    );
  }, []);

  return {
    // State
    currentSession,
    isLoading,
    memoryBuffer,
    
    // Actions
    addMessage,
    updateSessionMetadata,
    clearSession,
    loadSession,
    getUserSessions,
    
    // Context
    getConversationContext,
    getConversationSummary,
    searchMessages,
    
    // Session info
    sessionId: currentSession?.sessionId,
    messageCount: memoryBuffer.length,
    lastMessage: memoryBuffer[memoryBuffer.length - 1]
  };
}
