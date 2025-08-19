// Test script for TTS Edge Function
// Run this with: node test_tts.js

const SUPABASE_URL = "https://tgcmwjbfyoiawbaxlqdd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY213amJmeW9pYXdiYXhscWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4Mzg0MTQsImV4cCI6MjA2NzQxNDQxNH0.-CVDbsLKFdEpl35JGxmmAN4abh4A90WvavX2jcoNxW4";

async function testTTSEdgeFunction() {
  console.log("Testing TTS Edge Function...");
  
  const testText = "Hello, this is a test of the text-to-speech functionality. It should work now.";
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: testText
      })
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log("Success! Response data:", {
        hasAudioContent: !!data.audioContent,
        audioContentLength: data.audioContent?.length || 0,
        contentType: data.contentType,
        success: data.success
      });
    } else {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.error("Parsed error:", errorData);
      } catch (e) {
        console.error("Raw error text:", errorText);
      }
    }
  } catch (error) {
    console.error("Fetch error:", error.message);
  }
}

// Test with different text lengths
async function testVariousTextLengths() {
  const testCases = [
    "Short text",
    "This is a medium length text that should work fine for testing purposes.",
    "This is a longer text that approaches the limit. ".repeat(20),
    "A".repeat(5000) // This should fail due to length
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testText = testCases[i];
    console.log(`\n--- Test Case ${i + 1}: ${testText.length} characters ---`);
    console.log("Text preview:", testText.substring(0, 100) + (testText.length > 100 ? '...' : ''));
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text: testText
        })
      });
      
      console.log("Status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Success - Audio content length:", data.audioContent?.length || 0);
      } else {
        const errorText = await response.text();
        console.log("❌ Failed - Status:", response.status);
        try {
          const errorData = JSON.parse(errorText);
          console.log("Error details:", errorData.error, errorData.details);
        } catch (e) {
          console.log("Raw error:", errorText);
        }
      }
    } catch (error) {
      console.error("❌ Fetch error:", error.message);
    }
  }
}

// Run tests
console.log("=== TTS Edge Function Test ===\n");
testTTSEdgeFunction().then(() => {
  console.log("\n=== Testing Various Text Lengths ===\n");
  return testVariousTextLengths();
}).then(() => {
  console.log("\n=== Test Complete ===");
}).catch(console.error);
