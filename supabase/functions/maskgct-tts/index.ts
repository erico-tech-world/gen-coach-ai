import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const HF_API_KEY = Deno.env.get('HF_API_KEY');
    if (!HF_API_KEY) {
      throw new Error('HF_API_KEY environment variable not set');
    }

    // Parse request body
    const { text, language = 'en' } = await req.json();

    // Validate input
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text parameter is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (text.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 1000 characters allowed.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Map language codes for MaskGCT
    const languageMap: Record<string, string> = {
      'en': 'en',
      'fr': 'fr',
      'es': 'es',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'nl': 'nl',
      'pl': 'pl',
      'ru': 'ru',
      'ja': 'ja',
      'ko': 'ko',
      'zh': 'zh'
    };

    const targetLanguage = languageMap[language] || 'en';

    // Call Hugging Face MaskGCT model
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/maskgct-tts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            language: targetLanguage,
            voice: 'default',
            speed: 1.0,
            pitch: 1.0
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        audio: audioBase64,
        model: 'MaskGCT',
        language: targetLanguage,
        textLength: text.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('MaskGCT TTS Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        model: 'MaskGCT'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
