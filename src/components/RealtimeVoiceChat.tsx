import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Phone, PhoneOff, Send, Volume2, Brain, History, Trash2 } from "lucide-react";
import { useRealtimeVoiceChat, setMemoryManager } from "@/hooks/useRealtimeVoiceChat";
import { useAIVoiceChatMemory } from "@/hooks/useAIVoiceChatMemory";
import { Badge } from "@/components/ui/badge";

interface RealtimeVoiceChatProps {
  onUnmount?: () => void;
}

export function RealtimeVoiceChat({ onUnmount }: RealtimeVoiceChatProps) {
  const [textInput, setTextInput] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  
  const {
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
  } = useRealtimeVoiceChat();

  const {
    memoryBuffer,
    getConversationContext,
    getConversationSummary,
    addMessage,
    updateSessionMetadata,
    clearSession,
    messageCount,
    lastMessage
  } = useAIVoiceChatMemory();

  // Handle component unmount to terminate voice chat session
  useEffect(() => {
    return () => {
      // Only disconnect when component actually unmounts, not on re-renders
      if (onUnmount) {
        onUnmount();
      }
    };
  }, [onUnmount]); // Remove disconnect from dependencies to prevent unwanted calls

  // Connect memory manager to voice chat hook
  useEffect(() => {
    setMemoryManager({
      addMessage,
      getConversationContext,
      updateSessionMetadata
    });
  }, [addMessage, getConversationContext, updateSessionMetadata]);

  const handleSendText = () => {
    if (textInput.trim()) {
      // Add user message to memory
      addMessage({
        role: 'user',
        content: textInput.trim(),
        metadata: { context: 'text_input' }
      });
      
      sendTextMessage(textInput.trim());
      setTextInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          AI Voice Assistant
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          {messageCount > 0 && (
            <Badge variant="outline" className="ml-auto">
              {messageCount} messages
            </Badge>
          )}
        </CardTitle>
        
        {/* Memory Management Buttons */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMemory(!showMemory)}
            className="text-xs"
          >
            <Brain className="w-3 h-3 mr-1" />
            Memory
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSession}
            className="text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Connection Status */}
        {!isConnected && (
          <div className="text-center p-6 space-y-4">
            <div className="text-muted-foreground">
              <Phone className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">Connect to AI Voice Chat</h3>
              <p className="text-sm text-muted-foreground">
                Click the button below to start your voice conversation with AI
              </p>
            </div>
            <Button onClick={connect} className="w-full max-w-xs">
              <Phone className="w-4 h-4 mr-2" />
              Connect to Voice Chat
            </Button>
          </div>
        )}

        {/* Memory Display */}
        {showMemory && (
          <div className="bg-muted/20 border border-border rounded-lg p-4 max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Conversation Memory</span>
            </div>
            {memoryBuffer.length > 0 ? (
              <div className="space-y-2">
                {memoryBuffer.map((msg, index) => (
                  <div key={index} className="text-xs">
                    <span className={`font-medium ${msg.role === 'user' ? 'text-primary' : 'text-accent'}`}>
                      {msg.role === 'user' ? 'You' : 'AI'}:
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {msg.content.length > 100 ? `${msg.content.substring(0, 100)}...` : msg.content}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No conversation history yet.</p>
            )}
          </div>
        )}

        {/* Connected State - Show immediate interaction options */}
        {isConnected && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-accent">Voice Chat Active</span>
              </div>
              <p className="text-sm text-accent mb-3">
                You're now connected! You can speak to the AI or type messages below.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  disabled={isRecording}
                  className="text-accent border-accent/30 hover:bg-accent/10"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Start Speaking
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.querySelector('input')?.focus()}
                  className="text-accent border-accent/30 hover:bg-accent/10"
                >
                  Type Message
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 border rounded-lg p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {/* AI Speaking Indicator */}
            {isSpeaking && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                    <p className="text-sm text-primary">
                      AI is speaking...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Voice Controls */}
        <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg">
          <Button
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
            className="flex-1 max-w-xs"
          >
            {isRecording ? (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </>
            )}
          </Button>
          
          {/* Connection Status Indicator */}
          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-accent">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              Connected
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type a message or use voice..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
            className="flex-1"
          />
          <Button 
            onClick={handleSendText} 
            disabled={!isConnected || !textInput.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}