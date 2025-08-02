import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log("Realtime voice chat function started");
  
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

  try {
    // Parse request body with better error handling
    console.log("Reading request body");
    let requestData;
    
    try {
      const bodyText = await req.text();
      console.log('Request body length:', bodyText?.length || 0);
      
      if (!bodyText || bodyText.trim() === '') {
        console.log('Empty request body received');
        return new Response(JSON.stringify({ 
          error: 'Empty request body',
          details: 'Please provide a message in the request body'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      requestData = JSON.parse(bodyText);
      console.log('Request data parsed successfully');
    } catch (parseError) {
      console.error('Request parsing error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid request format',
        details: 'Request body must be valid JSON with a message field'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Request data received:', { hasMessage: !!requestData?.message });
    
    const { message } = requestData || {};

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error('Invalid message in request');
      return new Response(JSON.stringify({ 
        error: 'Message is required',
        details: 'Please provide a valid message string'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for OpenRouter API key
    console.log("Checking OpenRouter API key");
    // @ts-expect-error Deno global is available at runtime
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!openrouterApiKey) {
      console.error('OpenRouter API key not configured');
      return new Response(JSON.stringify({ 
        error: 'OpenRouter API key not configured',
        details: 'Server configuration issue - API key missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare API request for OpenRouter with improved prompt
    console.log(`Processing message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    
    const requestPayload = {
      model: 'deepseek/deepseek-r1:free',
      messages: [
        {
          role: 'system',
          content: `You are an intelligent AI tutor and educational assistant. Your role is to:

1. Provide clear, helpful, and educational responses
2. Explain concepts in an easy-to-understand manner
3. Offer practical examples and applications
4. Encourage learning and curiosity
5. Keep responses conversational and engaging for voice interaction
6. Limit responses to 2-3 sentences for optimal voice experience
7. Be supportive and encouraging in your teaching approach

Focus on being helpful, educational, and encouraging while maintaining a conversational tone suitable for voice interaction.`
        },
        {
          role: 'user',
          content: message.trim()
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
      top_p: 0.9
    };
    
    console.log("Calling OpenRouter API");

    // Call OpenRouter API with timeout and retry logic
    let openrouterResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('OpenRouter API fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          details: 'The AI service took too long to respond'
        }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw fetchError;
    }

    console.log(`OpenRouter API response status: ${openrouterResponse.status}`);

    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text();
      console.error(`OpenRouter API error: ${errorText}`);
      
      // Handle specific error cases
      if (openrouterResponse.status === 401) {
        return new Response(JSON.stringify({ 
          error: 'Authentication failed',
          details: 'Invalid OpenRouter API key or authentication issue'
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (openrouterResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: 'Too many requests to OpenRouter. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: `OpenRouter API error: ${openrouterResponse.status}`,
        details: errorText || 'Unknown API error'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse API response with validation
    let responseData;
    try {
      responseData = await openrouterResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse OpenRouter response as JSON:', jsonError);
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        details: 'The AI service returned an invalid response'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log("OpenRouter API response received");
    
    const aiResponse = responseData?.choices?.[0]?.message?.content;

    if (!aiResponse || typeof aiResponse !== 'string') {
      console.error(`No valid response content from OpenRouter API:`, responseData);
      return new Response(JSON.stringify({ 
        error: 'No response content from OpenRouter API',
        details: 'The AI service did not provide a valid response'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`AI response generated successfully (${aiResponse.length} characters)`);
    
    return new Response(JSON.stringify({ 
      response: aiResponse.trim(),
      success: true 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error(`Error in voice chat function: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Voice chat processing failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});