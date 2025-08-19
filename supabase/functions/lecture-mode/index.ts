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
    const { outline, topic, wikipediaSummary } = body || {};

    // @ts-expect-error Deno provided at runtime
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterApiKey) {
      return new Response(JSON.stringify({ success: false, error: "OPENROUTER_API_KEY missing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!outline || typeof outline !== "string") {
      return new Response(JSON.stringify({ success: false, error: "outline is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are GEN-COACH, an elite educator. Transform the provided module outline into an engaging, comprehensive lecture script suitable for voice delivery. 
Rules:
- Use clear, simple language; teach by explaining concepts, giving analogies, and practical examples.
- Treat the outline as headings; do NOT read bullet points verbatim.
- Insert checkpoints every 2–3 paragraphs with 1–2 questions to assess understanding (prefix with [CHECKPOINT]). Do not reveal answers until asked.
- Avoid emojis and raw symbols; speak them appropriately (e.g., say "bullet" instead of reading characters).
- Include brief pauses using [PAUSE] markers between major ideas.
- If wikipediaSummary is provided, incorporate useful, factual context.
- Keep the lecture long enough to cover the topic thoroughly, but structured in short paragraphs.
Output:
Return ONLY the lecture text as plain UTF-8 with [PAUSE] and [CHECKPOINT] markers.`;

    const user = `Topic: ${topic || "Module"}
Outline:
${outline}

Wikipedia summary (optional):
${wikipediaSummary || "(none)"}`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ success: false, error: `OpenRouter error ${resp.status}`, details: txt }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const lecture = data?.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ success: true, lecture }), {
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


