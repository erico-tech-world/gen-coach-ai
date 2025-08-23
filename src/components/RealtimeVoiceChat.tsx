import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Phone, PhoneOff, Send, Volume2 } from "lucide-react";
import { useRealtimeVoiceChat } from "@/hooks/useRealtimeVoiceChat";
import { Badge } from "@/components/ui/badge";

interface RealtimeVoiceChatProps {
  onUnmount?: () => void;
}

export function RealtimeVoiceChat({ onUnmount }: RealtimeVoiceChatProps) {
  const [textInput, setTextInput] = useState("");
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

  // Handle component unmount to terminate voice chat session
  useEffect(() => {
    return () => {
      // Only disconnect when component actually unmounts, not on re-renders
      if (onUnmount) {
        onUnmount();
      }
    };
  }, [onUnmount]); // Remove disconnect from dependencies to prevent unwanted calls

  const handleSendText = () => {
    if (textInput.trim()) {
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
        </CardTitle>
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

        {/* Connected State - Show immediate interaction options */}
        {isConnected && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">Voice Chat Active</span>
              </div>
              <p className="text-sm text-green-700 mb-3">
                You're now connected! You can speak to the AI or type messages below.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  disabled={isRecording}
                  className="text-green-700 border-green-300 hover:bg-green-100"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Start Speaking
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.querySelector('input')?.focus()}
                  className="text-green-700 border-green-300 hover:bg-green-100"
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
                <div className="max-w-[80%] rounded-lg p-3 bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
                    <p className="text-sm text-blue-800">
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
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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