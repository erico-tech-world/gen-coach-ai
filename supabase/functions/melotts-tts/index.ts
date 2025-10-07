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

    if (text.length > 3000) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 3000 characters allowed for multilingual content.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Map language codes for MeloTTS (extensive language support)
    const languageMap: Record<string, string> = {
      // European languages
      'en': 'en',
      'fr': 'fr',
      'es': 'es',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'nl': 'nl',
      'pl': 'pl',
      'ru': 'ru',
      'sv': 'sv',
      'da': 'da',
      'no': 'no',
      'fi': 'fi',
      'hu': 'hu',
      'cs': 'cs',
      'sk': 'sk',
      'sl': 'sl',
      'hr': 'hr',
      'bg': 'bg',
      'ro': 'ro',
      'el': 'el',
      'tr': 'tr',
      
      // Asian languages
      'ja': 'ja',
      'ko': 'ko',
      'zh': 'zh',
      'zh-cn': 'zh-cn',
      'zh-tw': 'zh-tw',
      'th': 'th',
      'vi': 'vi',
      'id': 'id',
      'ms': 'ms',
      'tl': 'tl',
      'my': 'my',
      'km': 'km',
      'lo': 'lo',
      
      // African languages
      'sw': 'sw',
      'yo': 'yo',
      'ig': 'ig',
      'ha': 'ha',
      'zu': 'zu',
      'xh': 'xh',
      'af': 'af',
      'st': 'st',
      'ts': 'ts',
      'tn': 'tn',
      'ss': 'ss',
      've': 've',
      'nr': 'nr',
      'nso': 'nso',
      
      // Middle Eastern languages
      'ar': 'ar',
      'fa': 'fa',
      'ur': 'ur',
      'he': 'he',
      'hi': 'hi',
      'bn': 'bn',
      'ta': 'ta',
      'te': 'te',
      'ml': 'ml',
      'kn': 'kn',
      'gu': 'gu',
      'pa': 'pa',
      'or': 'or',
      'as': 'as',
      'ne': 'ne',
      'si': 'si',
      // Note: Avoid duplicate keys
      'ka': 'ka',
      'hy': 'hy',
      'az': 'az',
      'kk': 'kk',
      'ky': 'ky',
      'uz': 'uz',
      'tk': 'tk',
      'mn': 'mn'
    };

    const targetLanguage = languageMap[language] || 'en';

    // If no HF key, go straight to fallback
    if (!HF_API_KEY) {
      return await fallbackWithGroq(text, language);
    }

    try {
      // Call Hugging Face MeloTTS model
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/melotts-tts',
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
              multilingual: true,
              quality: 'high'
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
          model: 'MeloTTS',
          language: targetLanguage,
          textLength: text.length,
          multilingual: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (hfError) {
      console.error('MeloTTS primary failed, attempting Groq fallback:', hfError);
      return await fallbackWithGroq(text, language);
    }

  } catch (error) {
    console.error('MeloTTS Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        model: 'MeloTTS'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
