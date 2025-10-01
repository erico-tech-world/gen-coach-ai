import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const allowedOrigins = ['http://localhost:8080', 'https://gen-coach-ai.vercel.app/', 'http://localhost:3000'];

const getCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
});
serve(async (req)=>{
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get environment variables
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_ACCESS_KEY_ID = Deno.env.get('VITE_CLOUDFLARE_ACCESS_KEY_ID');
    const CLOUDFLARE_SECRET_ACCESS_KEY = Deno.env.get('VITE_CLOUDFLARE_SECRET_ACCESS_KEY');
    const CLOUDFLARE_BUCKET_NAME = Deno.env.get('VITE_CLOUDFLARE_BUCKET_NAME');
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_ACCESS_KEY_ID || !CLOUDFLARE_SECRET_ACCESS_KEY || !CLOUDFLARE_BUCKET_NAME) {
      throw new Error('Cloudflare R2 environment variables not configured');
    }
    // Parse request body
    const { fileName, fileType, fileSize, userId, bucketName } = await req.json();
    // Validate input
    if (!fileName || !fileType || !fileSize || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: fileName, fileType, fileSize, userId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate file size (max 100MB)
    if (fileSize > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({
        error: 'File size exceeds maximum limit of 100MB'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Generate unique file ID
    const fileId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const key = `uploads/${userId}/${fileId}_${fileName}`;
    // Create S3-compatible client for R2
    const endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    // Generate presigned URL using AWS SDK v3 compatible approach
    const presignedUrl = await generatePresignedUrl(endpoint, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, bucketName || CLOUDFLARE_BUCKET_NAME, key, 'PUT', fileType, fileSize, 3600 // 1 hour expiration
    );
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      uploadUrl: presignedUrl,
      fileId: fileId,
      key: key,
      bucket: bucketName || CLOUDFLARE_BUCKET_NAME
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('R2 Upload URL Generation Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
/**
 * Generate presigned URL for S3-compatible storage (R2)
 */ async function generatePresignedUrl(endpoint, accessKeyId, secretAccessKey, bucket, key, method, contentType, contentLength, expiresIn) {
  const timestamp = Math.floor(Date.now() / 1000);
  const expiration = timestamp + expiresIn;
  // Create canonical request
  const canonicalRequest = [
    method,
    `/${key}`,
    '',
    'host:' + new URL(endpoint).host,
    'x-amz-content-sha256:UNSIGNED-PAYLOAD',
    'x-amz-date:' + new Date(timestamp * 1000).toISOString().replace(/[:-]|\.\d{3}/g, ''),
    '',
    'host;x-amz-content-sha256;x-amz-date',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  // Build dates and scope (Cloudflare R2 uses region "auto")
  const shortDate = new Date(timestamp * 1000).toISOString().slice(0, 10).replace(/[:-]/g, ''); // yyyymmdd
  const amzDate = new Date(timestamp * 1000).toISOString().replace(/[:-]|\.\d{3}/g, ''); // yyyymmddThhmmssZ
  const credentialScope = `${shortDate}/auto/s3/aws4_request`;
  // Create string to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  // Calculate signature
  const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, shortDate);
  const dateRegionKey = await hmacSha256(dateKey, 'auto');
  const dateRegionServiceKey = await hmacSha256(dateRegionKey, 's3');
  const signingKey = await hmacSha256(dateRegionServiceKey, 'aws4_request');
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map((b)=>b.toString(16).padStart(2, '0')).join('');
  // Build presigned URL
  const url = new URL(endpoint);
  url.pathname = `/${bucket}/${key}`;
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', expiresIn.toString());
  url.searchParams.set('X-Amz-SignedHeaders', 'host;x-amz-content-sha256;x-amz-date');
  url.searchParams.set('X-Amz-Signature', signature);
  return url.toString();
}
/**
 * HMAC-SHA256 implementation
 */ async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return signature;
}
/**
 * SHA256 implementation
 */ async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
