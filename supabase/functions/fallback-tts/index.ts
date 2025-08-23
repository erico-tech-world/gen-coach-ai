import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { text, language = 'en' } = body || {};

    // Validate input
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ success: false, error: "text is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.length > 1000) {
      return new Response(JSON.stringify({ success: false, error: "text too long", details: "Maximum 1000 characters allowed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.length < 10) {
      return new Response(JSON.stringify({ success: false, error: "text too short", details: "Minimum 10 characters required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-expect-error Deno runtime
    const huggingfaceToken = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!huggingfaceToken) {
      return new Response(JSON.stringify({ success: false, error: "HUGGINGFACE_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map language codes to Hugging Face TTS models
    const getTTSModel = (lang: string): string => {
      const modelMap: Record<string, string> = {
        'en': 'facebook/fastspeech2-en-ljspeech',
        'fr': 'facebook/fastspeech2-fr-mai',
        'pcm': 'facebook/fastspeech2-en-ljspeech', // Pidgin fallback to English
        'ig': 'facebook/fastspeech2-en-ljspeech',  // Igbo fallback to English
      };
      return modelMap[lang] || 'facebook/fastspeech2-en-ljspeech';
    };

    const model = getTTSModel(language);
    console.log(`Generating fallback TTS for language: ${language}, model: ${model}`);

    // Use Hugging Face Inference API for TTS
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${huggingfaceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face TTS API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Hugging Face TTS API error: ${errorText}`,
        details: `Status: ${response.status}`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 with chunked processing to avoid stack overflow
    const chunkedBase64 = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 8192;
      let result = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        result += btoa(String.fromCharCode(...chunk));
      }
      
      return result;
    };

    const audioContent = chunkedBase64(audioBuffer);

    return new Response(JSON.stringify({
      success: true,
      audioContent,
      contentType: "audio/wav",
      language: language,
      model: model
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Fallback TTS function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Fallback TTS processing failed",
      details: error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
