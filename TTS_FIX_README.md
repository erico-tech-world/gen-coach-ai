# GEN-COACH Text-to-Speech Fix Guide

## **Issue Identified**
The text-to-speech functionality was failing with "Speech Generation Failed" and "Edge Function returned a non-2XX status code" errors.

## **Root Cause**
**Data Format Mismatch**: The Edge Function was returning binary audio data directly, but the frontend expected a JSON response with base64-encoded audio.

## **What Was Fixed**

### 1. **Edge Function Response Format** ✅
- **Before**: Returned binary `audio/wav` data directly
- **After**: Returns JSON with base64-encoded audio:
  ```json
  {
    "audioContent": "base64EncodedAudioString",
    "contentType": "audio/wav",
    "success": true
  }
  ```

### 2. **Frontend Processing** ✅
- The `useTextToSpeech` hook already correctly expects `response.data.audioContent`
- Audio playback logic is properly implemented

## **Required Environment Variables**

Make sure these are set in your Supabase project dashboard:

```bash
# Required for TTS functionality
GROQ_API_KEY=your_groq_api_key_here

# Required for course generation
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Required for database operations
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional for YouTube integration
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## **Deployment Steps**

### 1. **Deploy the Fixed Edge Function**
```bash
supabase functions deploy text-to-speech
```

### 2. **Verify Environment Variables**
- Go to Supabase Dashboard → Project Settings → Environment Variables
- Ensure `GROQ_API_KEY` is set with a valid Groq API key

### 3. **Test the TTS Functionality**
- Create a course with AI-generated content
- Click the "Listen" button on any module
- Audio should now generate and play successfully

## **How It Works Now**

1. **User clicks "Listen" button** → `handleListen()` function is called
2. **Frontend calls Edge Function** → `supabase.functions.invoke('text-to-speech')`
3. **Edge Function calls Groq TTS API** → Converts text to audio using `playai-tts` model
4. **Audio is converted to base64** → Returned as JSON response
5. **Frontend receives base64 audio** → Converts to blob and plays via Audio API

## **Troubleshooting**

### If TTS still fails:

1. **Check Edge Function logs** in Supabase Dashboard
2. **Verify Groq API key** is valid and has quota
3. **Check browser console** for any JavaScript errors
4. **Ensure Edge Function is deployed** and accessible

### Common Error Messages:

- **"Groq API key not configured"** → Set `GROQ_API_KEY` in environment
- **"Authentication failed"** → Invalid or expired API key
- **"Rate limit exceeded"** → Wait and try again later
- **"Text too long"** → Reduce text length (max 4096 characters)

## **API Endpoints**

- **TTS Function**: `/functions/v1/text-to-speech`
- **Course Generation**: `/functions/v1/generate-course`
- **Test Validation**: `/functions/v1/validate-test`
- **Voice Chat**: `/functions/v1/realtime-voice-chat`

## **Success Indicators**

✅ **TTS Working**: Audio plays when clicking "Listen" button  
✅ **No Console Errors**: Clean browser console  
✅ **Edge Function Logs**: Successful API calls in Supabase logs  
✅ **Audio Quality**: Clear, understandable speech output  

---

**Your GEN-COACH TTS functionality should now work perfectly!** 🎉
