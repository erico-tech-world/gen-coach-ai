import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log("Text-to-speech function started");
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Allow GET requests for testing
  if (req.method === 'GET') {
    console.log("Handling GET request - returning test response");
    return new Response(JSON.stringify({ 
      message: 'TTS Edge Function is working',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only allow POST requests for TTS
  if (req.method !== 'POST') {
    console.log("Invalid method:", req.method);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Method not allowed',
      details: 'Only POST requests are supported for TTS functionality'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let requestBody;
  try {
    const bodyText = await req.text();
    console.log('Received request body length:', bodyText?.length || 0);
    console.log('Request body preview:', bodyText?.substring(0, 200) + (bodyText?.length > 200 ? '...' : ''));
    
    if (!bodyText || bodyText.trim() === '') {
      console.error('Empty request body received');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Empty request body',
        details: 'Request body cannot be empty'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    try {
      requestBody = JSON.parse(bodyText);
      console.log('Parsed request body successfully');
      console.log('Request body keys:', Object.keys(requestBody));
      console.log('Text field exists:', 'text' in requestBody);
      console.log('Text field type:', typeof requestBody.text);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError.message);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (readError) {
    console.error('Error reading request body:', readError.message);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to read request body',
      details: readError.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = requestBody || {};

    console.log('Raw request body:', requestBody);
    console.log('Extracted text field:', text);
    console.log('Text type:', typeof text);
    console.log('Text length:', text?.length || 0);
    console.log('Text trimmed length:', text?.trim()?.length || 0);
    console.log('Text preview:', text?.substring(0, 200) || 'undefined');

    // Validate input with better error messages
    if (!text) {
      console.error('Text field is missing or falsy:', text);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Text field is missing',
        details: 'The request must include a "text" field with the content to convert to speech'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof text !== 'string') {
      console.error('Text field is not a string:', typeof text, text);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Text field must be a string',
        details: `Received ${typeof text} instead of string. Please provide text content as a string.`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (text.trim() === '') {
      console.error('Text field is empty or only whitespace');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Text field is empty',
        details: 'The text field cannot be empty or contain only whitespace'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check text length (Groq TTS has limits, assume 4096 for safety)
    if (text.length > 4096) {
      console.error('Text too long:', text.length);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Text too long',
        details: `Text must be 4096 characters or less. Current length: ${text.length}. Please provide shorter text.`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Additional validation: check for very short text
    if (text.trim().length < 5) {
      console.error('Text too short:', text.trim().length);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Text too short',
        details: 'Text must be at least 5 characters long for meaningful speech generation.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-expect-error Deno global is available at runtime
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    console.log('Groq API key exists:', !!groqApiKey);
    
    if (!groqApiKey) {
      console.error('Groq API key not configured');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Groq API key not configured',
        details: 'Server configuration issue - API key missing'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing text-to-speech request:', {
      textLength: text.length,
      voice: 'Calum-PlayAI',
      preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      textStart: text.substring(0, 50),
      textEnd: text.length > 50 ? text.substring(text.length - 50) : ''
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
      
      return new Response(JSON.stringify({ 
        success: false,
        error: `Groq TTS API error`,
        status: groqResponse.status,
        details: errorText || 'Unknown API error'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the audio data
    const audioBuffer = await groqResponse.arrayBuffer();
    console.log('Audio data received, size:', audioBuffer.byteLength);

    if (audioBuffer.byteLength === 0) {
      console.error('Empty audio response from Groq TTS API');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Empty audio response',
        details: 'The TTS service returned empty audio data'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Text-to-speech conversion completed successfully');
    
    // Convert audio buffer to base64 and return as JSON
    try {
      // Avoid spreading large arrays into String.fromCharCode to prevent stack overflow
      const bytes = new Uint8Array(audioBuffer);
      const chunkSize = 0x8000; // 32KB chunks
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64Audio = btoa(binary);

      console.log('Audio conversion successful:', {
        originalSize: audioBuffer.byteLength,
        base64Size: base64Audio.length
      });

      return new Response(JSON.stringify({ 
        success: true,
        audioContent: base64Audio,
        contentType: 'audio/wav'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (conversionError) {
      console.error('Audio conversion error:', conversionError.message);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to convert audio response',
        details: 'Audio processing failed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred',
      details: 'Text-to-speech conversion failed'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});