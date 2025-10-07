import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const bucketName = 'user-uploads'

    console.log('Checking if storage bucket exists:', bucketName)

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw new Error(`Failed to list buckets: ${listError.message}`)
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName)

    if (bucketExists) {
      console.log('Storage bucket already exists:', bucketName)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Storage bucket already exists',
          bucketName 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create the bucket
    console.log('Creating storage bucket:', bucketName)
    const { data: bucket, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: false,
      allowedMimeTypes: [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      fileSizeLimit: 5 * 1024 * 1024 // 5MB
    })

    if (createError) {
      console.error('Error creating bucket:', createError)
      throw new Error(`Failed to create bucket: ${createError.message}`)
    }

    console.log('Storage bucket created successfully:', bucket)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Storage bucket created successfully',
        bucketName,
        bucket 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in ensure-storage-bucket function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})


