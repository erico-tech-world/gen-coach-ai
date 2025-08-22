import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Map app language keys to model language codes (approx)
// en: English, fr: French, pcm: Nigerian Pidgin (approximate mapping), ig: Igbo
const LangCode: Record<string, string> = {
  en: "eng_Latn",
  fr: "fra_Latn",
  pcm: "pcm_Latn",
  ig: "ibo_Latn",
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
    const { text, target_language } = body || {};

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ success: false, error: "text is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = typeof target_language === "string" ? target_language : "en";
    const tgtCode = LangCode[target] || LangCode["en"];

    // Use Hugging Face Inference API for translation with NLLB-200
    // Requires HF token in env
    // @ts-expect-error Deno runtime
    const hfToken = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!hfToken) {
      // If no token, return original text (noop) but mark not translated
      return new Response(JSON.stringify({ success: true, translated: false, text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      inputs: text,
      parameters: {
        tgt_lang: tgtCode,
      },
      options: { wait_for_model: true }
    };

    const resp = await fetch("https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ success: false, error: `HF error ${resp.status}`, details: txt }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // HF outputs can be arrays or objects depending on pipeline; try to parse
    let translatedText = "";
    if (Array.isArray(data) && data[0]?.translation_text) {
      translatedText = data[0].translation_text;
    } else if (typeof data === 'object') {
      translatedText = data?.translation_text || data?.[0]?.generated_text || text;
    } else {
      translatedText = text;
    }

    return new Response(JSON.stringify({ success: true, translated: true, text: translatedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


