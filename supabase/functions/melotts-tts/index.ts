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
      'my': 'my',
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

  } catch (error) {
    console.error('MeloTTS Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        model: 'MeloTTS'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
