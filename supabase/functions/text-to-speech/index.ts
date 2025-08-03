import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log("Text-to-speech function started");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      details: 'Only POST requests are supported'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let requestBody;
  try {
    const bodyText = await req.text();
    console.log('Received request body length:', bodyText?.length || 0);
    
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
    const { text } = requestBody || {};

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

    // Check text length (limit to 1000 characters for stability)
    if (text.length > 1000) {
      console.error('Text too long:', text.length);
      return new Response(JSON.stringify({ 
        error: 'Text too long',
        details: 'Text must be 1000 characters or less'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing text-to-speech request:', {
      textLength: text.length,
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    // Try multiple TTS approaches in order of preference
    
    // First, try OpenRouter with DeepSeek TTS if available
    // @ts-expect-error Deno global is available at runtime
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    if (openrouterApiKey) {
      console.log('Attempting TTS with OpenRouter...');
      try {
        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/tts-1',
            voice: 'alloy',
            input: text.trim(),
            response_format: 'wav'
          }),
        });

        if (openrouterResponse.ok) {
          const audioBuffer = await openrouterResponse.arrayBuffer();
          if (audioBuffer.byteLength > 0) {
            console.log('OpenRouter TTS successful, audio size:', audioBuffer.byteLength);
            
            // Convert to base64 for frontend compatibility
            const uint8Array = new Uint8Array(audioBuffer);
            const base64Audio = btoa(String.fromCharCode(...uint8Array));
            
            return new Response(JSON.stringify({
              audioContent: base64Audio,
              success: true
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        console.log('OpenRouter TTS failed with status:', openrouterResponse.status);
      } catch (error) {
        console.log('OpenRouter TTS error:', error.message);
      }
    }

    // Fallback: Try Groq TTS if API key is available
    // @ts-expect-error Deno global is available at runtime
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    
    if (groqApiKey) {
      console.log('Attempting TTS with Groq...');
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'alloy',
            input: text.trim(),
            response_format: 'wav'
          }),
        });

        if (groqResponse.ok) {
          const audioBuffer = await groqResponse.arrayBuffer();
          if (audioBuffer.byteLength > 0) {
            console.log('Groq TTS successful, audio size:', audioBuffer.byteLength);
            
            // Convert to base64 for frontend compatibility
            const uint8Array = new Uint8Array(audioBuffer);
            const base64Audio = btoa(String.fromCharCode(...uint8Array));
            
            return new Response(JSON.stringify({
              audioContent: base64Audio,
              success: true
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        console.log('Groq TTS failed with status:', groqResponse.status);
      } catch (error) {
        console.log('Groq TTS error:', error.message);
      }
    }

    // Final fallback: Use a free TTS service or return error with browser fallback suggestion
    console.log('All external TTS services failed, suggesting browser fallback');
    
    return new Response(JSON.stringify({ 
      error: 'TTS service unavailable',
      details: 'External TTS services are not configured or unavailable. The browser\'s built-in speech synthesis will be used instead.',
      useBrowserFallback: true
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Text-to-speech conversion failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});