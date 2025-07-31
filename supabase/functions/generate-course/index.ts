import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface CourseModule {
  id: string;
  title: string;
  content: string;
  test: string;
  completed: boolean;
}

interface YouTubeLink {
  title: string;
  url: string;
  thumbnail: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  try {
    const bodyText = await req.text();
    console.log('Received request body length:', bodyText.length);
    
    if (!bodyText) {
      throw new Error('Empty request body');
    }
    
    requestBody = JSON.parse(bodyText);
    console.log('Parsed request - prompt length:', requestBody.prompt?.length || 0);
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
    const { prompt, userId, userName } = requestBody;

    if (!prompt || !userId) {
      throw new Error('Prompt and userId are required');
    }

    // @ts-expect-error Deno global is available at runtime
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    // @ts-expect-error Deno global is available at runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-expect-error Deno global is available at runtime
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // @ts-expect-error Deno global is available at runtime
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

    console.log('Environment check:', {
      hasOpenRouterKey: !!openrouterApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasYouTubeKey: !!youtubeApiKey
    });

    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key not configured in environment variables');
    }

    console.log('Starting course generation with OpenRouter DeepSeek model...');
    
    // Generate course content using OpenRouter DeepSeek model
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'system',
            content: `You are an expert course creator and educational content developer. Create a comprehensive, well-structured course based on ${userName ? `${userName}'s` : 'the user\'s'} request. \n\nCRITICAL: Format your response EXACTLY as follows with proper XML tags:\n\n<TITLE_HEADING>Course Title Here</TITLE_HEADING>\n\n<SECTION_HEADING>Module 1: Introduction and Fundamentals</SECTION_HEADING>\n<SECTION_BODY>\nProvide detailed, educational content for this module. Include:\n- Clear explanations of key concepts\n- Practical examples and applications\n- Step-by-step breakdowns where appropriate\n- Real-world context and relevance\nMake this comprehensive and engaging for learners.\n</SECTION_BODY>\n<SECTION_TEST>\n1. What is the primary focus of this module?\na) Basic concepts and fundamentals\nb) Advanced applications only\nc) Historical background only\nd) Practical exercises only\nAnswer: a\n\n2. Which of the following best describes the learning approach in this module?\na) Memorization-based learning\nb) Conceptual understanding with practical examples\nc) Theory without application\nd) Advanced topics only\nAnswer: b\n</SECTION_TEST>\n\n<SECTION_HEADING>Module 2: Core Concepts and Applications</SECTION_HEADING>\n<SECTION_BODY>\nBuild upon the foundation from Module 1. Include:\n- Deeper exploration of core concepts\n- Practical applications and use cases\n- Problem-solving techniques\n- Interactive examples\n</SECTION_BODY>\n<SECTION_TEST>\n1. How do the concepts in this module build upon Module 1?\na) They are completely unrelated\nb) They extend and apply the foundational knowledge\nc) They replace the previous concepts\nd) They are simplified versions\nAnswer: b\n\n2. What is the main goal of this module?\na) To introduce basic concepts\nb) To apply and extend core knowledge\nc) To provide historical context\nd) To conclude the course\nAnswer: b\n</SECTION_TEST>\n\nContinue this pattern for 3-5 modules total. Each module should be substantial, educational, and progressively build knowledge. Make the course comprehensive, practical, and engaging.`
          },
          { 
            role: 'user', 
            content: `Create a comprehensive course about: ${prompt}\n\nPlease ensure the course is:\n- Well-structured with clear learning progression\n- Practical and applicable\n- Engaging and educational\n- Suitable for learners at various levels\n- Contains real-world examples and applications`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    console.log('OpenRouter API response status:', openrouterResponse.status);

    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API error: ${openrouterResponse.status} - ${errorText}`);
    }

    const data = await openrouterResponse.json();
    console.log('DeepSeek response received successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid DeepSeek response format:', data);
      throw new Error('Invalid response format from DeepSeek API');
    }
    
    const generatedContent = data.choices[0].message.content;
    console.log('Generated content length:', generatedContent.length);

    // Parse the generated content with improved regex
    const titleMatch = generatedContent.match(/<TITLE_HEADING>(.*?)<\/TITLE_HEADING>/s);
    const title = titleMatch ? titleMatch[1].trim() : `Course: ${prompt}`;

    // Extract modules with improved parsing
    const moduleRegex = /<SECTION_HEADING>(.*?)<\/SECTION_HEADING>\s*<SECTION_BODY>(.*?)<\/SECTION_BODY>\s*<SECTION_TEST>(.*?)<\/SECTION_TEST>/gs;
    const modules: CourseModule[] = [];
    let match;
    let moduleIndex = 1;

    while ((match = moduleRegex.exec(generatedContent)) !== null) {
      modules.push({
        id: crypto.randomUUID(),
        title: match[1].trim(),
        content: match[2].trim(),
        test: match[3].trim(),
        completed: false
      });
      moduleIndex++;
    }

    // If no modules were parsed, create comprehensive fallback modules
    if (modules.length === 0) {
      console.log('No modules parsed, creating comprehensive fallback modules');
      
      const fallbackModules = [
        {
          id: crypto.randomUUID(),
          title: "Introduction and Overview",
          content: `Welcome to your comprehensive course on ${prompt}. This introductory module will provide you with a solid foundation and overview of what you'll learn throughout this course.\n\nKey topics covered:\n- Fundamental concepts and terminology\n- Historical context and development\n- Real-world applications and importance\n- Learning objectives and outcomes\n\nBy the end of this module, you'll have a clear understanding of the scope and relevance of ${prompt} in today's world.`,
          test: `1. What is the main focus of this course?\na) ${title}\nb) General education\nc) Unrelated topics\nd) Basic skills only\nAnswer: a\n\n2. Why is understanding ${prompt} important?\na) It's not important\nb) It has practical applications in many fields\nc) It's only for experts\nd) It's outdated knowledge\nAnswer: b`,
          completed: false
        },
        {
          id: crypto.randomUUID(),
          title: "Core Concepts and Fundamentals",
          content: `In this module, we'll dive deeper into the core concepts that form the foundation of ${prompt}. You'll learn the essential principles, key terminology, and fundamental theories that underpin this subject.\n\nWhat you'll learn:\n- Essential definitions and concepts\n- Key principles and theories\n- Foundational knowledge building blocks\n- Common misconceptions and clarifications\n\nThis module builds directly on the introduction and prepares you for more advanced topics in subsequent modules.`,
          test: `1. What are the core concepts in ${prompt}?\na) Basic foundational principles\nb) Only advanced theories\nc) Unrelated information\nd) Historical facts only\nAnswer: a\n\n2. How does this module relate to the introduction?\na) It's completely separate\nb) It builds upon and expands the foundational knowledge\nc) It contradicts the introduction\nd) It's a summary of the introduction\nAnswer: b`,
          completed: false
        },
        {
          id: crypto.randomUUID(),
          title: "Practical Applications and Examples",
          content: `Now that you understand the fundamentals, this module focuses on practical applications of ${prompt}. You'll see how theoretical knowledge translates into real-world scenarios and practical solutions.\n\nModule highlights:\n- Real-world case studies and examples\n- Practical problem-solving techniques\n- Industry applications and use cases\n- Hands-on exercises and activities\n\nBy completing this module, you'll be able to apply your knowledge in practical situations and understand the relevance of ${prompt} in various contexts.`,
          test: `1. What is the main focus of this module?\na) Theoretical concepts only\nb) Practical applications and real-world examples\nc) Historical background\nd) Advanced mathematics\nAnswer: b\n\n2. How do practical applications help learning?\na) They don't help\nb) They make concepts more concrete and understandable\nc) They complicate the subject\nd) They are only for experts\nAnswer: b`,
          completed: false
        },
        {
          id: crypto.randomUUID(),
          title: "Advanced Topics and Future Directions",
          content: `In this final module, we'll explore advanced topics in ${prompt} and discuss future directions and emerging trends. This module is designed to challenge your understanding and prepare you for continued learning.\n\nAdvanced topics include:\n- Cutting-edge developments and research\n- Complex problem-solving scenarios\n- Integration with other fields and disciplines\n- Future trends and opportunities\n- Resources for continued learning\n\nCompleting this module will give you a comprehensive understanding of ${prompt} and prepare you for advanced study or professional application.`,
          test: `1. What characterizes advanced topics in ${prompt}?\na) They are simpler than basics\nb) They build on fundamentals and explore complex applications\nc) They are unrelated to previous modules\nd) They are only theoretical\nAnswer: b\n\n2. What is the purpose of discussing future directions?\na) To confuse students\nb) To prepare learners for ongoing developments in the field\nc) To end the course quickly\nd) To avoid practical applications\nAnswer: b`,
          completed: false
        }
      ];
      
      modules.push(...fallbackModules);
    }

    console.log(`Generated ${modules.length} modules for course: ${title}`);

    // Fetch Wikipedia data with better error handling
    let wikipediaData = {};
    try {
      console.log('Fetching Wikipedia data...');
      const wikiSearchTerm = title.replace(/^Course:\s*/, '').trim();
      const wikiResponse = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiSearchTerm)}`,
        {
          headers: {
            'User-Agent': 'CourseGenerator/1.0 (https://example.com/contact)'
          }
        }
      );
      
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        wikipediaData = {
          title: wikiData.title,
          extract: wikiData.extract,
          thumbnail: wikiData.thumbnail?.source,
          url: wikiData.content_urls?.desktop?.page
        };
        console.log('Wikipedia data fetched successfully');
      } else {
        console.log('Wikipedia API returned:', wikiResponse.status);
      }
    } catch (error) {
      console.log('Wikipedia fetch failed:', error.message);
    }

    // Fetch YouTube links with better error handling
    let youtubeLinks: YouTubeLink[] = [];
    try {
      if (youtubeApiKey) {
        console.log('Fetching YouTube videos...');
        const searchQuery = title.replace(/^Course:\s*/, '').trim();
        const ytResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery + ' tutorial')}&type=video&maxResults=5&key=${youtubeApiKey}&safeSearch=strict&relevanceLanguage=en`
        );
        
        if (ytResponse.ok) {
          const ytData = await ytResponse.json();
          youtubeLinks = ytData.items?.map((item: { id: { videoId: string }, snippet: { title: string, thumbnails: { default?: { url: string }, medium?: { url: string } } } }) => ({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            thumbnail: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url
          })) || [];
          console.log(`Fetched ${youtubeLinks.length} YouTube videos`);
        } else {
          console.log('YouTube API returned:', ytResponse.status);
        }
      } else {
        console.log('YouTube API key not available');
      }
    } catch (error) {
      console.log('YouTube fetch failed:', error.message);
    }

    // Save to Supabase with better error handling
    let courseId = null;
    if (supabaseUrl && supabaseServiceKey) {
      try {
        console.log('Saving course to database...');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: courseData, error: insertError } = await supabase
          .from('courses')
          .insert({
            user_id: userId,
            title,
            topic: prompt,
            modules,
            youtube_links: youtubeLinks,
            wikipedia_data: wikipediaData,
            progress: 0,
            schedule: 'Self-paced',
            additional_details: `AI-generated course with ${modules.length} modules`
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving course:', insertError);
          throw new Error(`Database error: ${insertError.message}`);
        } else {
          courseId = courseData.id;
          console.log('Course saved successfully with ID:', courseId);
        }
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
        throw new Error(`Failed to save course: ${dbError.message}`);
      }
    }

    const resultResponse = {
      courseId,
      title,
      modules,
      youtubeLinks,
      wikipediaData,
      success: true
    };

    console.log('Course generation completed successfully');
    
    return new Response(JSON.stringify(resultResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-course function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Course generation failed',
      timestamp: new Date().toISOString(),
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});