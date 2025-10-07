#!/usr/bin/env node

/**
 * TTS Function Test Script
 * Tests all TTS Edge Functions to verify they work correctly
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tgcmwjbfyoiawbaxlqdd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const testText = "Hello, this is a test of the text-to-speech system.";
const testLanguage = "en";

const ttsFunctions = [
  { name: 'MaskGCT TTS', endpoint: 'maskgct-tts', maxLength: 1000 },
  { name: 'VibeVoice TTS', endpoint: 'vibevoice-tts', maxLength: 2000 },
  { name: 'Chatterbox TTS', endpoint: 'chatterbox-tts', maxLength: 1500 },
  { name: 'MeloTTS', endpoint: 'melotts-tts', maxLength: 3000 },
  { name: 'Groq TTS', endpoint: 'text-to-speech', maxLength: 1000 },
  { name: 'Fallback TTS', endpoint: 'fallback-tts', maxLength: 1000 }
];

async function testTTSFunction(functionInfo) {
  const { name, endpoint, maxLength } = functionInfo;
  
  console.log(`\n🧪 Testing ${name}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: testText,
        language: testLanguage
      })
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      if (responseData.success) {
        console.log(`✅ ${name}: SUCCESS`);
        console.log(`   Audio data length: ${responseData.audio?.length || responseData.audioContent?.length || 'N/A'} chars`);
        console.log(`   Model: ${responseData.model || 'N/A'}`);
        return true;
      } else {
        console.log(`❌ ${name}: FAILED - ${responseData.error || 'Unknown error'}`);
        return false;
      }
    } else {
      console.log(`❌ ${name}: HTTP ${response.status}`);
      console.log(`   Error: ${responseData.error || responseData.raw || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: NETWORK ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting TTS Function Tests');
  console.log(`📡 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📝 Test Text: "${testText}"`);
  console.log(`🌍 Language: ${testLanguage}`);
  
  const results = [];
  
  for (const functionInfo of ttsFunctions) {
    const success = await testTTSFunction(functionInfo);
    results.push({ name: functionInfo.name, success });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => console.log(`   - ${r.name}`));
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`   - ${r.name}`));
    
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Check that HUGGINGFACE_API_KEY is set in Supabase Dashboard');
    console.log('2. Check that GROQ_API_KEY is set in Supabase Dashboard');
    console.log('3. Verify Edge Functions are deployed: supabase functions deploy');
    console.log('4. Check function logs: supabase functions logs <function-name>');
  }
  
  console.log('\n✨ Test completed!');
}

// Run the tests
runTests().catch(console.error);
