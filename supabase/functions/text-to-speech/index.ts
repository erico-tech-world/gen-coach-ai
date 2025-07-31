import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  try {
    const bodyText = await req.text();
    console.log('Received request body length:', bodyText.length);
    
    if (!bodyText || bodyText.trim() === '') {
      console.error('Empty request body received');
      return new Response(JSON.stringify({ 
        error: 'Empty request body',
        details: 'Request body cannot be empty'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    try {
      requestBody = JSON.parse(bodyText);
      console.log('Parsed request body successfully');
    } catch (parseError) {
      console.error('JSON parsing error:', parseError.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (readError) {
    console.error('Error reading request body:', readError.message);
    return new Response(JSON.stringify({ 
      error: 'Failed to read request body',
      details: readError.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = requestBody;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('Invalid text in request:', text);
      return new Response(JSON.stringify({ 
        error: 'Text is required and must be a non-empty string',
        details: 'Please provide valid text to convert to speech'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check text length (Groq TTS has limits, assume 4096 for safety)
    if (text.length > 4096) {
      console.error('Text too long:', text.length);
      return new Response(JSON.stringify({ 
        error: 'Text too long',
        details: 'Text must be 4096 characters or less'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-expect-error Deno global is available at runtime
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    console.log('Groq API key exists:', !!groqApiKey);
    
    if (!groqApiKey) {
      console.error('Groq API key not configured');
      return new Response(JSON.stringify({ 
        error: 'Groq API key not configured in environment variables',
        details: 'Server configuration issue'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing text-to-speech request:', {
      textLength: text.length,
      voice: 'Calum-PlayAI',
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    // Log request payload for debugging (without API key)
    const requestPayload = {
      model: 'playai-tts',
      input: text.trim(),
      voice: 'Calum-PlayAI',
      response_format: 'wav',
    };
    console.log('Groq TTS request payload:', requestPayload);

    // Generate speech using Groq TTS with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for TTS

      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Groq TTS API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq TTS API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          requestPayload: requestPayload
        });
        
        if (response.status === 401) {
          throw new Error('Authentication failed - Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded - Please try again later');
        } else if (response.status === 400) {
          throw new Error(`Bad request - Check model/voice parameters: ${errorText}`);
        } else if (response.status === 404) {
          throw new Error(`Model or endpoint not found: ${errorText}`);
        } else {
          throw new Error(`Groq TTS API error: ${response.status} - ${errorText}`);
        }
      }

      // Convert audio buffer to base64
      try {
        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Received empty audio response');
        }
        
        const base64Audio = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        );

        console.log('Audio conversion successful:', {
          originalSize: arrayBuffer.byteLength,
          base64Size: base64Audio.length
        });

        return new Response(JSON.stringify({ 
          audioContent: base64Audio,
          contentType: 'audio/wav',
          success: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (conversionError) {
        console.error('Audio conversion error:', conversionError.message);
        throw new Error('Failed to convert audio response');
      }
    } catch (apiError) {
      console.error('Groq TTS API call failed:', apiError.message);
      
      if (apiError.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          details: 'Text-to-speech generation took too long'
        }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to get response from Groq TTS API',
        details: apiError.message
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in text-to-speech function:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Text-to-speech processing failed',
      timestamp: new Date().toISOString(),
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});