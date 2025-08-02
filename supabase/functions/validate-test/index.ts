import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log("Validate test function started");
  
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
      console.log('Empty request body received');
      return new Response(JSON.stringify({ 
        error: 'Empty request body',
        details: 'Please provide question and answer for validation'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    requestBody = JSON.parse(bodyText);
    console.log('Parsed request body successfully');
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    return new Response(JSON.stringify({ 
      error: 'Invalid JSON in request body',
      details: parseError.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { question, answer, userName } = requestBody || {};

    if (!question || !answer) {
      console.error('Missing required fields:', { hasQuestion: !!question, hasAnswer: !!answer });
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        details: 'Question and answer are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof question !== 'string' || typeof answer !== 'string') {
      console.error('Invalid field types:', { questionType: typeof question, answerType: typeof answer });
      return new Response(JSON.stringify({ 
        error: 'Invalid field types',
        details: 'Question and answer must be strings'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-expect-error Deno global is available at runtime
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    console.log('OpenRouter API key exists:', !!openrouterApiKey);
    
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

    console.log('Validating test answer...');

    const requestPayload = {
      model: 'deepseek/deepseek-r1:free',
      messages: [
        {
          role: 'system',
          content: `You are an expert test validator and educational assessor. Your job is to evaluate ${userName ? `${userName}'s` : 'the student\'s'} answer against the given question and determine if it's correct.

CRITICAL: Format your response EXACTLY as follows:

<CREDIBILITY>true/false</CREDIBILITY>
<REASON>Brief explanation of why the answer is correct or incorrect. Be specific about what makes the answer right or wrong.</REASON>

Guidelines for evaluation:
- Be fair but thorough in your assessment
- Consider partial credit for answers that show understanding
- Look for key concepts and correct reasoning
- Accept reasonable variations in wording if the core concept is correct
- Be strict with factual accuracy
- Provide constructive feedback in your reason

Remember: Only respond with the exact format above.`
        },
        {
          role: 'user',
          content: `Question: ${question.trim()}

Student Answer: ${answer.trim()}

Please evaluate this answer and provide your assessment in the required format.`
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
    };

    // Call OpenRouter API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return new Response(JSON.stringify({ 
        error: `OpenRouter API error: ${response.status}`,
        details: errorText || 'Unknown API error'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('OpenRouter response received successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenRouter response format:', data);
      return new Response(JSON.stringify({ 
        error: 'Invalid response format from OpenRouter API',
        details: 'The AI service returned an unexpected response format'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const aiResponse = data.choices[0].message.content;
    console.log('AI validation response received');

    // Parse the response using regex
    const credibilityMatch = aiResponse.match(/<CREDIBILITY>(.*?)<\/CREDIBILITY>/s);
    const reasonMatch = aiResponse.match(/<REASON>(.*?)<\/REASON>/s);

    if (!credibilityMatch || !reasonMatch) {
      console.error('Could not parse AI response:', aiResponse);
      return new Response(JSON.stringify({ 
        error: 'Could not parse AI validation response',
        details: 'The AI service returned an invalid response format'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credibility = credibilityMatch[1].trim().toLowerCase();
    const reason = reasonMatch[1].trim();

    // Convert string to boolean
    const isCorrect = credibility === 'true' || credibility === 'correct' || credibility === 'yes';

    console.log('Validation completed successfully');
    
    return new Response(JSON.stringify({
      isCorrect,
      reason,
      success: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-test function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Test validation failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});