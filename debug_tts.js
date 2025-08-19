// Comprehensive TTS Debugging Script
// Run this with: node debug_tts.js

const SUPABASE_URL = "https://tgcmwjbfyoiawbaxlqdd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY213amJmeW9pYXdiYXhscWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4Mzg0MTQsImV4cCI6MjA2NzQxNDQxNH0.-CVDbsLKFdEpl35JGxmmAN4abh4A90WvavX2jcoNxW4";

async function testTTSEndpoint() {
  console.log("=== Testing TTS Endpoint ===\n");
  
  // Test 1: GET request to check if function is accessible
  try {
    console.log("1. Testing GET request...");
    const getResponse = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log("GET Response status:", getResponse.status);
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log("✅ GET successful:", data);
    } else {
      console.log("❌ GET failed");
    }
  } catch (error) {
    console.error("GET request error:", error.message);
  }

  // Test 2: POST with minimal valid text
  try {
    console.log("\n2. Testing POST with minimal text...");
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: "Hello"
      })
    });
    
    console.log("POST Response status:", response.status);
    console.log("POST Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ POST successful:", {
        hasAudioContent: !!data.audioContent,
        audioContentLength: data.audioContent?.length || 0,
        contentType: data.contentType,
        success: data.success
      });
    } else {
      const errorText = await response.text();
      console.log("❌ POST failed with status:", response.status);
      console.log("Error response:", errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.log("Parsed error:", errorData);
      } catch (e) {
        console.log("Raw error text:", errorText);
      }
    }
  } catch (error) {
    console.error("POST request error:", error.message);
  }

  // Test 3: POST with empty text (should fail)
  try {
    console.log("\n3. Testing POST with empty text...");
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: ""
      })
    });
    
    console.log("Empty text POST status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log("Expected error for empty text:", errorText);
    }
  } catch (error) {
    console.error("Empty text POST error:", error.message);
  }

  // Test 4: POST with missing text field (should fail)
  try {
    console.log("\n4. Testing POST with missing text field...");
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });
    
    console.log("Missing text POST status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log("Expected error for missing text:", errorText);
    }
  } catch (error) {
    console.error("Missing text POST error:", error.message);
  }

  // Test 5: POST with realistic course content
  try {
    console.log("\n5. Testing POST with realistic course content...");
    const realisticText = "Introduction to AI. This module covers the fundamental concepts of artificial intelligence including machine learning algorithms neural networks and deep learning applications.";
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: realisticText
      })
    });
    
    console.log("Realistic content POST status:", response.status);
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Realistic content successful:", {
        hasAudioContent: !!data.audioContent,
        audioContentLength: data.audioContent?.length || 0
      });
    } else {
      const errorText = await response.text();
      console.log("❌ Realistic content failed:", errorText);
    }
  } catch (error) {
    console.error("Realistic content POST error:", error.message);
  }

  // Test 6: POST with very long text (should fail)
  try {
    console.log("\n6. Testing POST with very long text...");
    const longText = "A".repeat(5000);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: longText
      })
    });
    
    console.log("Long text POST status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log("Expected error for long text:", errorText);
    }
  } catch (error) {
    console.error("Long text POST error:", error.message);
  }
}

// Test CORS preflight
async function testCORS() {
  console.log("\n=== Testing CORS Preflight ===\n");
  
  try {
    console.log("Testing OPTIONS request...");
    const response = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    console.log("OPTIONS Response status:", response.status);
    console.log("OPTIONS Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      console.log("✅ CORS preflight successful");
    } else {
      console.log("❌ CORS preflight failed");
    }
  } catch (error) {
    console.error("CORS test error:", error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting TTS Edge Function Debug Tests\n");
  
  try {
    await testTTSEndpoint();
    await testCORS();
    
    console.log("\n🎯 All tests completed!");
    console.log("\n📋 Summary:");
    console.log("- If GET works: Function is accessible");
    console.log("- If POST with 'Hello' works: Basic TTS is functional");
    console.log("- If CORS works: Frontend can call the function");
    console.log("- Check error messages above for specific issues");
    
  } catch (error) {
    console.error("Test execution error:", error);
  }
}

runAllTests();
