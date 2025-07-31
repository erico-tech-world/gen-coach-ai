import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Phone, PhoneOff, Send, Volume2 } from "lucide-react";
import { useRealtimeVoiceChat } from "@/hooks/useRealtimeVoiceChat";
import { Badge } from "@/components/ui/badge";

export function RealtimeVoiceChat() {
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            AI Voice Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isSpeaking ? "AI Speaking" : isRecording ? "Listening" : isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {isConnected ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                <PhoneOff className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={connect}>
                <Phone className="w-4 h-4 mr-1" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <ScrollArea className="flex-1 border rounded-lg p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Current AI transcript */}
            {currentTranscript && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-muted text-muted-foreground border-2 border-dashed">
                  <p className="text-sm">{currentTranscript}</p>
                  <span className="text-xs opacity-70">AI is speaking...</span>
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

        {!isConnected && (
          <p className="text-sm text-muted-foreground text-center">
            Click "Connect" to start real-time voice conversation with AI
          </p>
        )}
      </CardContent>
    </Card>
  );
}