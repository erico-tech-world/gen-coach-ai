// @ts-nocheck
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
    // Helper: fallback to Groq-based edge function if HF is unavailable
    const fallbackWithGroq = async (text: string, language: string) => {
      // @ts-expect-error Deno provided at runtime
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      // @ts-expect-error Deno provided at runtime
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
      const origin = supabaseUrl || new URL(req.url).origin;
      const groqLangMap: Record<string, string> = {
        'en': 'en-US',
        'en-US': 'en-US',
        'en-GB': 'en-GB',
        'fr': 'fr-FR',
        'fr-FR': 'fr-FR'
      };
      const groqLanguage = groqLangMap[language] || 'en-US';
      const groqResp = await fetch(`${origin}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(supabaseAnonKey ? { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` } : {})
        },
        body: JSON.stringify({ text, language: groqLanguage })
      });
      if (!groqResp.ok) {
        const t = await groqResp.text();
        throw new Error(`Groq fallback failed: ${groqResp.status} - ${t}`);
      }
      const groqData = await groqResp.json();
      if (!groqData?.success || !groqData?.audioContent) {
        throw new Error('Groq fallback returned invalid response');
      }
      return new Response(
        JSON.stringify({
          success: true,
          audio: groqData.audioContent,
          model: 'Groq (Fallback)',
          language: groqLanguage
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // Get environment variables (optional; we fall back if missing)
    const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');

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

    if (text.length > 1500) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 1500 characters allowed for expressive content.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Map language codes for Chatterbox
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

    // If no HF key, go straight to fallback
    if (!HF_API_KEY) {
      return await fallbackWithGroq(text, language);
    }

    try {
      // Call Hugging Face Chatterbox model
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/chatterbox-tts',
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
              pitch: 1.0,
              expressiveness: 'high',
              style: 'conversational'
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
          model: 'Chatterbox',
          language: targetLanguage,
          textLength: text.length
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (hfError) {
      console.error('Chatterbox primary failed, attempting Groq fallback:', hfError);
      return await fallbackWithGroq(text, language);
    }

  } catch (error) {
    console.error('Chatterbox TTS Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        model: 'Chatterbox'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
