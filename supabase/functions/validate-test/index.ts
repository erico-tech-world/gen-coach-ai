import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  try {
    const bodyText = await req.text();
    console.log('Received request body length:', bodyText.length);
    
    if (!bodyText || bodyText.trim() === '') {
      throw new Error('Empty request body');
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
    const { question, answer, userName } = requestBody;

    if (!question || !answer) {
      throw new Error('Question and answer are required');
    }

    if (typeof question !== 'string' || typeof answer !== 'string') {
      throw new Error('Question and answer must be strings');
    }

    // @ts-expect-error Deno global is available at runtime
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    console.log('OpenRouter API key exists:', !!openrouterApiKey);
    
    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key not configured in environment variables');
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

    // Call DeepSeek API with timeout
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
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const validationContent = data.choices?.[0]?.message?.content;

    if (!validationContent) {
      console.error('No validation response from OpenRouter API:', data);
      throw new Error('No validation response from OpenRouter API');
    }

    console.log('Validation content received:', validationContent.substring(0, 200));

    // Parse the validation result with improved regex
    const credibilityMatch = validationContent.match(/<CREDIBILITY>\s*(true|false)\s*<\/CREDIBILITY>/i);
    const reasonMatch = validationContent.match(/<REASON>\s*(.*?)\s*<\/REASON>/is);

    if (!credibilityMatch) {
      console.error('Could not parse credibility from response:', validationContent);
      throw new Error('Invalid validation response format - missing credibility');
    }

    const credible = credibilityMatch[1].trim().toLowerCase() === 'true';
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Unable to extract validation reason';

    // Fallback validation if parsing fails
    if (!reasonMatch) {
      console.warn('Could not parse reason, using fallback logic');
      // Simple fallback logic based on content analysis
      const lowerContent = validationContent.toLowerCase();
      if (lowerContent.includes('correct') || lowerContent.includes('right') || lowerContent.includes('accurate')) {
        // Keep the credible value from the credibility tag
      } else if (lowerContent.includes('incorrect') || lowerContent.includes('wrong') || lowerContent.includes('inaccurate')) {
        // Keep the credible value from the credibility tag
      }
    }

    console.log('Test validation completed:', { credible, reason: reason.substring(0, 100) });

    return new Response(JSON.stringify({ 
      credible,
      reason,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-test function:', error);
    console.error('Error stack:', error.stack);
    
    // Provide fallback validation in case of API failure
    const fallbackResponse = {
      credible: false,
      reason: 'Unable to validate answer due to technical issues. Please try again or contact support.',
      success: false,
      error: error.message
    };
    
    return new Response(JSON.stringify(fallbackResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});