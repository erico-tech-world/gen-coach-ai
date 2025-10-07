import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { message, userName, conversationHistory = [] } = body || {};

    if (!message) {
      return new Response(JSON.stringify({ success: false, error: "Message is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-expect-error Deno runtime
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openRouterApiKey) {
      return new Response(JSON.stringify({ success: false, error: "OpenRouter API key not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enhanced system prompt for better AI assistant behavior
    const systemPrompt = `You are GEN-COACH, an intelligent AI learning assistant and educational companion. You are:

1. **Academic Expert**: Help with learning, problem-solving, and understanding complex topics
2. **Intellectual Guide**: Provide thoughtful insights and encourage critical thinking
3. **Learning Companion**: Support users in their educational journey with patience and clarity
4. **GEN-COACH Navigator**: Help users understand and use GEN-COACH features effectively

**Your Capabilities:**
- Answer academic questions and explain concepts clearly
- Help with problem-solving and critical thinking
- Provide learning strategies and study tips
- Guide users through GEN-COACH features and course creation
- Engage in meaningful intellectual discussions
- Offer encouragement and motivation for learning

**Response Guidelines:**
- Be conversational, friendly, and encouraging
- Provide clear, accurate, and helpful information
- Ask follow-up questions to better understand user needs
- Suggest relevant GEN-COACH features when appropriate
- Keep responses concise but comprehensive
- Always be supportive and positive
- NEVER mention technical details, file references, or raw text formats
- NEVER include phrases like "using the uploaded file", "reference document", or technical context
- Focus on providing clean, user-friendly responses that enhance the learning experience

**GEN-COACH Features to Mention:**
- AI-powered course generation
- Text-to-speech for course content
- Voice chat for interactive learning
- Course progress tracking
- Multiple language support (English, French, Pidgin, Igbo)
- Document upload for enhanced course creation

**IMPORTANT**: Always provide clean, professional responses. Do not expose any technical implementation details, file paths, URLs, or system information to users. Focus on being helpful and educational while maintaining a professional, user-friendly tone.

Current user: ${userName || 'User'}

Remember: You're here to help users learn, grow, and make the most of their GEN-COACH experience!`;

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-5) // Keep last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const fullPrompt = conversationContext 
      ? `${systemPrompt}\n\nRecent conversation:\n${conversationContext}\n\nUser: ${message}\n\nGEN-COACH:`
      : `${systemPrompt}\n\nUser: ${message}\n\nGEN-COACH:`;

    console.log('Sending request to OpenRouter API...');
    
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gen-coach-ai.vercel.app',
        'X-Title': 'GEN-COACH AI Assistant'
      },
      body: JSON.stringify({
      model: 'deepseek/deepseek-r1:free',
      messages: [
        {
          role: 'system',
            content: systemPrompt
          },
          ...conversationHistory.slice(-10).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
        {
          role: 'user',
            content: message
        }
      ],
        max_tokens: 500,
      temperature: 0.7,
        stream: false
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('OpenRouter API error:', errorText);
      // Graceful local fallback message when rate-limited or unavailable
      const fallback = `I’m currently experiencing high demand and can't access my advanced reasoning model. However, I can still help. Could you rephrase or narrow your question?`;
      return new Response(JSON.stringify({ 
        success: true,
        response: fallback,
        model: 'fallback-local'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openRouterData = await openRouterResponse.json();
    
    if (!openRouterData.choices || !openRouterData.choices[0] || !openRouterData.choices[0].message) {
      console.error('Invalid response from OpenRouter:', openRouterData);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid response from AI service' 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = openRouterData.choices[0].message.content;

    // Clean the AI response to remove any technical references or raw text formats
    const cleanResponse = cleanAIResponse(aiResponse);

    console.log('AI response generated and cleaned successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      response: cleanResponse,
      model: 'deepseek-r1',
      usage: openRouterData.usage
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('Error in realtime-voice-chat function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Function to clean AI response content for better user experience
function cleanAIResponse(response: string): string {
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
}