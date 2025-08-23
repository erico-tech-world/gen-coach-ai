import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Payload size limits
const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB maximum payload size (increased from 1MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB maximum file size

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
  console.log("Generate course function started");
  
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
    
    // Validate payload size
    if (bodyText && bodyText.length > MAX_PAYLOAD_SIZE) {
      console.error('Payload too large:', bodyText.length, 'bytes (max:', MAX_PAYLOAD_SIZE, 'bytes)');
      return new Response(JSON.stringify({ 
        error: 'Payload too large',
        details: `Request body size (${Math.round(bodyText.length / 1024)}KB) exceeds maximum allowed size (${MAX_PAYLOAD_SIZE / 1024}KB). Please use smaller files or upload large documents to cloud storage.`
      }), {
        status: 413, // Payload Too Large
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty request body received');
      return new Response(JSON.stringify({ 
        error: 'Empty request body',
        details: 'Please provide course generation parameters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    requestBody = JSON.parse(bodyText);
    console.log('Parsed request - prompt length:', requestBody?.prompt?.length || 0);
    console.log('Request ID:', requestBody?.requestId || 'none');
    console.log('File URL provided:', !!requestBody?.fileUrl);
    console.log('File size:', requestBody?.fileSize || 'not provided');
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
    const { prompt, userId, userName, language, requestId, fileUrl, fileSize } = requestBody || {};

    // Validate required fields
    if (!prompt || !userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        details: 'prompt and userId are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file size if provided
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: 'File too large',
        details: `File size (${Math.round(fileSize / 1024)}KB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024}KB)`
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-expect-error Deno runtime
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    // @ts-expect-error Deno runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-expect-error Deno runtime
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

    // Validate environment variables
    if (!openRouterApiKey) {
      console.error('Missing OPENROUTER_API_KEY environment variable');
      return new Response(JSON.stringify({ 
        error: 'OpenRouter API key not configured',
        details: 'Please configure OPENROUTER_API_KEY environment variable'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!supabaseServiceKey 
      });
      return new Response(JSON.stringify({ 
        error: 'Supabase configuration incomplete',
        details: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced idempotency check - check for existing course with same request ID
    let idempotencyCheckPassed = true;
    let existingCourseId = null;
    
    if (requestId) {
      try {
        console.log('Performing idempotency check for request ID:', requestId);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Check if a course with this request ID already exists
        const { data: existingCourse, error: checkError } = await supabase
          .from('courses')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .eq('additional_details', `AI-generated course with request ID: ${requestId}`)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "no rows returned" - that's expected for new requests
          console.error('Error during idempotency check:', checkError);
        }

        if (existingCourse) {
          console.log('Course with request ID already exists:', requestId, 'Course ID:', existingCourse.id);
          existingCourseId = existingCourse.id;
          idempotencyCheckPassed = false;
        } else {
          // Additional check: look for courses with same topic created recently by same user
          const { data: recentCourses, error: recentError } = await supabase
            .from('courses')
            .select('id, title, created_at')
            .eq('user_id', userId)
            .eq('topic', prompt)
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentError) {
            console.error('Error checking recent courses:', recentError);
          } else if (recentCourses && recentCourses.length > 0) {
            const recentCourse = recentCourses[0];
            const timeDiff = Date.now() - new Date(recentCourse.created_at).getTime();
            const minutesAgo = Math.floor(timeDiff / (1000 * 60));
            
            console.log('Recent course with same topic found:', recentCourse.id, 'created', minutesAgo, 'minutes ago');
            
            if (minutesAgo < 60) {
              console.log('Similar course recently created, preventing duplicate');
              existingCourseId = recentCourse.id;
              idempotencyCheckPassed = false;
            }
          }
        }

        if (idempotencyCheckPassed) {
          console.log('Idempotency check passed - no duplicates found');
        }
      } catch (error) {
        console.error('Idempotency check failed:', error);
        // Continue with course creation if idempotency check fails
        // This prevents blocking legitimate requests due to check failures
        idempotencyCheckPassed = true;
      }
    }

    // If idempotency check failed, return existing course
    if (!idempotencyCheckPassed && existingCourseId) {
      return new Response(JSON.stringify({ 
        error: 'Course already exists',
        details: 'A similar course has already been created recently',
        existingCourseId: existingCourseId,
        success: false
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced system prompt for better course generation
    const systemPrompt = `You are GEN-COACH, an expert AI educator. Create a comprehensive, structured course based on the user's request.

Course Structure Requirements:
- Create 4-6 modules with clear, engaging titles
- Each module should have 3-5 key learning objectives
- Include practical examples and real-world applications
- Structure content from basic to advanced concepts
- Ensure logical progression between modules
- Make content engaging and interactive

Output Format:
Return ONLY a JSON object with this exact structure:
{
  "title": "Course Title",
  "modules": [
    {
      "id": "1",
      "title": "Module Title",
      "content": "Detailed module content with learning objectives, key concepts, examples, and practical applications. Make this comprehensive and educational.",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "completed": false
    }
  ],
  "youtubeLinks": [
    {
      "title": "Video Title",
      "url": "https://youtube.com/watch?v=...",
      "thumbnail": "https://img.youtube.com/vi/.../default.jpg"
    }
  ],
  "wikipediaData": {
    "summary": "Brief summary of the topic",
    "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"]
  }
}

Language: ${language || 'en'}
User: ${userName || 'Student'}`;

    let userPrompt = `Create a comprehensive course about: ${prompt}`;
    
    // Add file context if provided (for AI processing only)
    if (fileUrl) {
      userPrompt += `\n\n[AI CONTEXT ONLY] Reference document available for enhanced content generation.`;
      if (fileSize) {
        userPrompt += `\nFile size: ${Math.round(fileSize / 1024)}KB`;
      }
    }

    userPrompt += `\n\nIMPORTANT INSTRUCTIONS:
- Generate a professional, concise course title that focuses on the main topic
- DO NOT include phrases like "using the uploaded file", "reference document", file names, URLs, or any technical details in the title
- DO NOT include phrases like "using the uploaded file", "reference document", file names, URLs, or any technical details in module titles or content
- The title should be clean, user-friendly, and professional
- Use the reference document to enhance content quality but never mention it in the user-facing content
- Ensure all content is clean and free of technical references

Please ensure the course is:
- Well-structured with clear learning objectives
- Practical and applicable to real-world scenarios
- Engaging and interactive
- Suitable for the specified language: ${language || 'en'}
- Professional and user-friendly in presentation`;

    console.log('Calling OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `OpenRouter API error: ${response.status}`,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return new Response(JSON.stringify({ 
        error: 'No content received from AI',
        details: 'The AI model did not return any content'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Parsing AI response...');
    let courseData;
    try {
      // Try to parse as JSON first
      courseData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Raw AI response:', content);
      // Fallback: create a basic course structure
      courseData = {
        title: `Course on ${prompt}`,
        modules: [
          {
            id: "1",
            title: "Introduction",
            content: `Welcome to your course on ${prompt}. This module will introduce you to the fundamental concepts and prepare you for the learning journey ahead.`,
            objectives: ["Understand the basics", "Set learning goals", "Prepare for advanced topics"],
            completed: false
          },
          {
            id: "2", 
            title: "Core Concepts",
            content: `In this module, we'll explore the core concepts of ${prompt}. You'll learn the essential principles and foundational knowledge needed to master this topic.`,
            objectives: ["Learn core principles", "Understand key concepts", "Apply basic knowledge"],
            completed: false
          },
          {
            id: "3",
            title: "Advanced Topics", 
            content: `Now we'll dive into advanced topics related to ${prompt}. This module builds upon your foundational knowledge and explores more complex applications.`,
            objectives: ["Master advanced concepts", "Apply complex principles", "Solve challenging problems"],
            completed: false
          },
          {
            id: "4",
            title: "Practice & Assessment",
            content: `In this final module, you'll practice what you've learned and assess your understanding of ${prompt}. This includes practical exercises and self-assessment tools.`,
            objectives: ["Practice skills", "Assess understanding", "Apply knowledge"],
            completed: false
          }
        ],
        youtubeLinks: [],
        wikipediaData: {
          summary: `A comprehensive course covering ${prompt}`,
          keyConcepts: ["Fundamentals", "Core Principles", "Advanced Applications"]
        }
      };
    }

    // Extract course information
    const title = courseData.title || `Course on ${prompt}`;
    const modules = courseData.modules || [];
    const youtubeLinks = courseData.youtubeLinks || [];
    const wikipediaData = courseData.wikipediaData || {};

    // Clean up the title to remove any technical references or file URLs
    const cleanTitle = title
      .replace(/\[AI CONTEXT ONLY.*?\]/g, '') // Remove AI context markers
      .replace(/using the uploaded file/gi, '')
      .replace(/reference document/gi, '')
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/file:\s*[^\s]+/gi, '') // Remove file references
      .replace(/\s+/g, ' ') // Clean up extra whitespace
      .trim();

    // Clean up module content to remove technical references
    const cleanModules = modules.map(module => ({
      ...module,
      title: module.title
        .replace(/\[AI CONTEXT ONLY.*?\]/g, '')
        .replace(/using the uploaded file/gi, '')
        .replace(/reference document/gi, '')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/file:\s*[^\s]+/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
      content: module.content
        .replace(/\[AI CONTEXT ONLY.*?\]/g, '')
        .replace(/using the uploaded file/gi, '')
        .replace(/reference document/gi, '')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/file:\s*[^\s]+/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }));

    // Save to Supabase with better error handling and idempotency
    let courseId = null;
    try {
      console.log('Saving course to database...');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Create clean additional details without technical file information
      let additionalDetails = `AI-generated course with ${cleanModules.length} modules in ${language || 'en'}`;
      if (requestId) {
        additionalDetails += ` - Request ID: ${requestId}`;
      }
      if (fileUrl) {
        additionalDetails += ` - Enhanced with uploaded document`; // Clean description
      }
      
      const { data: insertedCourse, error: insertError } = await supabase
        .from('courses')
        .insert({
          user_id: userId,
          title: cleanTitle, // Use cleaned title
          topic: prompt,
          modules: cleanModules, // Use cleaned modules
          youtube_links: youtubeLinks,
          wikipedia_data: wikipediaData,
          progress: 0,
          schedule: 'Self-paced',
          additional_details: additionalDetails,
          file_url: fileUrl || null,
          file_size: fileSize || null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving course:', insertError);
        return new Response(JSON.stringify({ 
          error: `Database error: ${insertError.message}`,
          details: 'Failed to save course to database'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        courseId = insertedCourse.id;
        console.log('Course saved successfully with ID:', courseId, 'Request ID:', requestId);
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return new Response(JSON.stringify({ 
        error: `Failed to save course: ${dbError.message}`,
        details: 'Database operation failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultResponse = {
      courseId,
      title: cleanTitle, // Return cleaned title
      modules: cleanModules, // Return cleaned modules
      youtubeLinks,
      wikipediaData,
      language: language || 'en',
      success: true,
      requestId, // Include request ID in response for debugging
      fileUrl, // Include file URL in response
      fileSize // Include file size in response
    };

    console.log('Course generation completed successfully');
    
    return new Response(JSON.stringify(resultResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-course function:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});