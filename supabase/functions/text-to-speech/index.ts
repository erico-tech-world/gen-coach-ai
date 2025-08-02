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
        error: 'Groq API key not configured',
        details: 'Server configuration issue - API key missing'
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

    // Call Groq TTS API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'playai-tts',
        voice: 'Calum-PlayAI',
        input: text.trim(),
        response_format: 'wav'
      }),
    });

    console.log('Groq TTS API response status:', groqResponse.status);

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq TTS API error:', errorText);
      
      // Handle specific error cases
      if (groqResponse.status === 401) {
        return new Response(JSON.stringify({ 
          error: 'Authentication failed',
          details: 'Invalid Groq API key or authentication issue'
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (groqResponse.status === 400) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request',
          details: 'The text or parameters provided are invalid'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (groqResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: 'Too many requests to Groq TTS. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: `Groq TTS API error: ${groqResponse.status}`,
        details: errorText || 'Unknown API error'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the audio data
    const audioBuffer = await groqResponse.arrayBuffer();
    console.log('Audio data received, size:', audioBuffer.byteLength);

    if (audioBuffer.byteLength === 0) {
      console.error('Empty audio response from Groq TTS API');
      return new Response(JSON.stringify({ 
        error: 'Empty audio response',
        details: 'The TTS service returned empty audio data'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Text-to-speech conversion completed successfully');
    
    // Return the audio data
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
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