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
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_ACCESS_KEY_ID = Deno.env.get('VITE_CLOUDFLARE_ACCESS_KEY_ID');
    const CLOUDFLARE_SECRET_ACCESS_KEY = Deno.env.get('VITE_CLOUDFLARE_SECRET_ACCESS_KEY');
    const CLOUDFLARE_BUCKET_NAME = Deno.env.get('VITE_CLOUDFLARE_BUCKET_NAME');
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_ACCESS_KEY_ID || !CLOUDFLARE_SECRET_ACCESS_KEY || !CLOUDFLARE_BUCKET_NAME) {
      throw new Error('Cloudflare R2 environment variables not configured');
    }
    const { fileUrl, bucketName } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter: fileUrl'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    // Derive key and bucket
    let key;
    let bucket = bucketName || CLOUDFLARE_BUCKET_NAME;
    if (fileUrl.startsWith('http')) {
      const u = new URL(fileUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        return new Response(JSON.stringify({
          error: 'Unable to parse file key from URL'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      bucket = parts[0];
      key = parts.slice(1).join('/');
    } else {
      key = fileUrl.replace(/^\/+/, '');
    }
    // Use S3 DeleteObject REST API with signed request
    const deleteUrl = await generatePresignedUrl(endpoint, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, bucket, key, 'DELETE', '', 0, 60 // short-lived
    );
    const resp = await fetch(deleteUrl, {
      method: 'DELETE'
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Delete failed with status ${resp.status}: ${body}`);
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('R2 Delete Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
async function generatePresignedUrl(endpoint, accessKeyId, secretAccessKey, bucket, key, method, contentType, contentLength, expiresIn) {
  const timestamp = Math.floor(Date.now() / 1000);
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
  const shortDate = new Date(timestamp * 1000).toISOString().slice(0, 10).replace(/[:-]/g, '');
  const amzDate = new Date(timestamp * 1000).toISOString().replace(/[:-]|\.\d{3}/g, '');
  const credentialScope = `${shortDate}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, shortDate);
  const dateRegionKey = await hmacSha256(dateKey, 'auto');
  const dateRegionServiceKey = await hmacSha256(dateRegionKey, 's3');
  const signingKey = await hmacSha256(dateRegionServiceKey, 'aws4_request');
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map((b)=>b.toString(16).padStart(2, '0')).join('');
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
async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
}
