// Debug script for Edge Function testing
// Run this in Node.js to test the Edge Function directly

const testEdgeFunction = async () => {
  const SUPABASE_URL = "https://tgcmwjbfyoiawbaxlqdd.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY213amJmeW9pYXdiYXhscWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4Mzg0MTQsImV4cCI6MjA2NzQxNDQxNH0.-CVDbsLKFdEpl35JGxmmAN4abh4A90WvavX2jcoNxW4";
  
  const testPayload = {
    prompt: "Introduction to JavaScript Programming",
    userId: "test-user-id",
    userName: "Test User",
    language: "en",
    requestId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  console.log('Testing Edge Function with payload:', testPayload);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-course`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed response:', data);
      } catch (parseError) {
        console.log('Response is not valid JSON');
      }
    } else {
      console.error('Request failed with status:', response.status);
    }
    
  } catch (error) {
    console.error('Request failed:', error);
  }
};

// Test environment variables
console.log('Environment check:');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL || 'Not set');
console.log('- OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set (length: ' + process.env.OPENROUTER_API_KEY.length + ')' : 'Not set');
console.log('- SERVICE_ROLE_KEY:', process.env.SERVICE_ROLE_KEY ? 'Set (length: ' + process.env.SERVICE_ROLE_KEY.length + ')' : 'Not set');

// Run test
testEdgeFunction();
