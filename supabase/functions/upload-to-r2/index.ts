import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const allowedOrigins = ['http://localhost:8080', 'https://gen-coach-ai.vercel.app/', 'http://localhost:3000'];

const getCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
});

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Starting file upload process...');

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const signedUrl = formData.get('signedUrl') as string;

    console.log('Form data parsed:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      hasSignedUrl: !!signedUrl,
      signedUrlLength: signedUrl?.length
    });

    if (!file || !signedUrl) {
      console.error('Missing required data:', { hasFile: !!file, hasSignedUrl: !!signedUrl });
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing file or signed URL'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Convert File to ArrayBuffer for proper handling
    const fileBuffer = await file.arrayBuffer();
    console.log('File converted to buffer, size:', fileBuffer.byteLength);

    // Upload file to R2 using the signed URL
    console.log('Uploading to R2:', signedUrl);
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    });

    console.log('R2 upload response:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('R2 upload failed:', errorText);
      throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
    }

    // Extract file ID from signed URL more reliably
    const urlParts = signedUrl.split('/');
    const fileName = urlParts[urlParts.length - 1].split('?')[0];
    const fileNameParts = fileName.split('_');
    const fileId = fileNameParts.length >= 3 ? fileNameParts[2] : fileNameParts[0];

    console.log('Upload successful, file ID:', fileId);

    return new Response(JSON.stringify({
      success: true,
      url: signedUrl.split('?')[0], // Remove query parameters
      fileId: fileId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Upload to R2 Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
