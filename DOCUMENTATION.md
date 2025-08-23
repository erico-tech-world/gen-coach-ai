# GEN-COACH AI Documentation

## Project Overview

GEN-COACH is an AI-powered educational platform that generates personalized courses using advanced AI models. The platform features text-to-speech capabilities, real-time voice chat, and multi-language support.

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **TanStack Query** for data fetching
- **React Router DOM** for routing
- **Vercel** for deployment

### Backend
- **Supabase** (PostgreSQL, Auth, Storage, Edge Functions)
- **OpenRouter API** (DeepSeek R1 model for course generation)
- **Groq TTS API** (PlayAI model for text-to-speech)
- **Hugging Face API** (fallback TTS for unsupported languages)

### AI/ML Services
- **Course Generation**: OpenRouter API with DeepSeek R1
- **Text-to-Speech**: Groq TTS (primary) + Hugging Face (fallback)
- **Voice Chat**: Custom Edge Function with real-time capabilities
- **Translation**: Hugging Face models (NLLB, Masakhane)

## Architecture

### Database Schema

#### Tables
1. **profiles** - User profile information
   - `id` (UUID, primary key)
   - `full_name` (text)
   - `avatar_url` (text)
   - `language_preference` (varchar(10), default: 'en')
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **courses** - Generated course content
   - `id` (UUID, primary key)
   - `user_id` (UUID, foreign key to profiles.id)
   - `title` (text)
   - `topic` (text)
   - `modules` (jsonb)
   - `youtube_links` (jsonb)
   - `wikipedia_data` (jsonb)
   - `progress` (integer, default: 0)
   - `schedule` (text, default: 'Self-paced')
   - `additional_details` (text)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

### Authentication Flow

1. **Sign Up**: Email/password or Google OAuth
2. **Email Verification**: Automatic redirect to confirmation page
3. **Profile Creation**: Automatic profile row creation via database trigger
4. **Language Preference**: Stored in profiles table, used throughout the app

### Course Generation Flow

1. **User Input**: Topic + optional document upload
2. **Language Selection**: User's preferred language or override
3. **AI Processing**: OpenRouter API generates course content
4. **Database Storage**: Course saved with language metadata
5. **UI Update**: New course appears in user's list

### Text-to-Speech Flow

1. **Language Detection**: Check user's language preference
2. **Primary TTS**: Try Groq TTS if language supported
3. **Fallback TTS**: Use Hugging Face models for unsupported languages
4. **Audio Processing**: Chunk text, generate audio, play sequentially
5. **Browser Fallback**: Use browser's SpeechSynthesis API as last resort

## Key Features

### Multi-Language Support
- **Supported Languages**: English (en), French (fr), Pidgin (pcm), Igbo (ig)
- **Language Selection**: Available in Settings and Course Creation
- **TTS Integration**: Automatic language-appropriate speech synthesis
- **Translation Pipeline**: Text generation → translation → TTS

### Course Management
- **AI Generation**: Personalized courses based on user input
- **Document Upload**: Support for .txt, .md, .doc, .docx, .pdf files
- **Progress Tracking**: Visual progress indicators
- **Course Deletion**: Confirmation dialog with database cleanup

### Voice Features
- **Lecture Mode**: AI coach speaks course content naturally
- **Symbol Filtering**: Removes emojis/symbols for natural speech
- **Chunking**: Breaks long text into manageable audio segments
- **Real-time Voice Chat**: Interactive AI assistant

### Authentication & Security
- **Email/Password**: Standard Supabase Auth
- **Google OAuth**: Third-party authentication
- **Email Verification**: Required for new accounts
- **Password Reset**: Forgot password flow
- **Row Level Security**: Database-level access control

## File Structure

```
src/
├── components/
│   ├── AuthPage.tsx              # Authentication UI
│   ├── CourseCreationOverlay.tsx # Course generation modal
│   ├── CourseMaterialPage.tsx    # Course viewing/lecture
│   ├── HomeScreen.tsx            # Main dashboard
│   ├── Navbar.tsx                # Navigation component
│   ├── RealtimeVoiceChat.tsx     # Voice chat interface
│   └── Settings.tsx              # User settings
├── hooks/
│   ├── useAI.ts                  # AI service interactions
│   ├── useCourses.ts             # Course management
│   ├── useProfile.ts             # User profile management
│   ├── useTextToSpeech.ts        # TTS functionality
│   └── use-toast.ts              # Toast notifications
├── integrations/
│   └── supabase/
│       └── client.ts             # Supabase client
└── types/
    └── index.ts                  # TypeScript definitions

supabase/
├── functions/
│   ├── generate-course/          # Course generation
│   ├── text-to-speech/           # Groq TTS
│   ├── fallback-tts/             # Hugging Face TTS
│   └── realtime-voice-chat/      # Voice chat
└── migrations/
    ├── 20250821090001_add_course_uniqueness.sql
    ├── 20250821090002_add_language_preference.sql
    └── 20250821090003_prevent_duplicate_courses.sql
```

## Recent Updates & Fixes

### Storage Migration Error Fix (Latest)
- **Issue**: `42501: must be owner of table objects` error when running storage bucket migration, followed by `ERROR: 42601: syntax error at or near "IF"` due to nested function definitions.
- **Root Cause**: User running migration lacked `OWNER` privileges on `storage.objects` table. Additionally, PostgreSQL doesn't allow nested function definitions, causing syntax errors. **CRITICAL ISSUE**: Even `SECURITY DEFINER` functions cannot modify the `storage.objects` system table.
- **Fix**: Implemented alternative approach that completely avoids ownership restrictions by not modifying system tables directly. Created helper functions and manual policy setup process.
- **Implementation**: 
  - Created `cleanup_orphaned_files()` function that uses `storage.delete()` instead of direct table access
  - Created `can_access_file()` function for file access validation
  - Created `validate_file_upload()` function for upload validation
  - Migration creates helper functions and triggers
  - Storage policies are created manually in Supabase Dashboard to bypass ownership restrictions
- **Files Modified**: `supabase/migrations/20250823000001_create_storage_bucket_and_policies.sql`
- **Additional Files**: `MANUAL_STORAGE_SETUP_GUIDE.md` - Step-by-step manual setup instructions

### AI Voice Chat Connection Flow Enhancement (Latest)
- **Issue**: Users reported being redirected after connecting to voice chat. Additionally, users were getting disconnected immediately after connection, making the Start Recording button inactive.
- **Root Cause**: Connection flow needed better user feedback and immediate interaction options. Additionally, the return arrow function was calling `handleVoiceChatToggle(false)` which immediately closed the voice chat. The connection logic was also failing due to race conditions and improper state management. **CRITICAL ISSUE**: The `useEffect` cleanup function in `RealtimeVoiceChat` component was calling `disconnect()` on every re-render, causing immediate disconnection.
- **Fix**: Enhanced connection experience with better state management and user guidance. Fixed the return arrow to only close voice chat when actually navigating away, not during normal operations. Improved connection logic to prevent immediate disconnection. **FIXED**: Removed `disconnect` from `useEffect` dependencies to prevent unwanted disconnections.
- **Implementation**:
  - Added connecting state with progress feedback
  - Enhanced connection success notification
  - Added welcome message from AI assistant
  - Provided immediate interaction options (speak/type) after connection
  - Improved error handling and user guidance
  - Fixed return arrow navigation logic to prevent unwanted closures
  - Improved connection state management to prevent race conditions
  - Enhanced recording functionality to work properly after connection
  - **FIXED**: Removed `useEffect` cleanup that was causing immediate disconnection
  - Added debug logging to track connection state changes
- **Files Modified**: 
  - `src/hooks/useRealtimeVoiceChat.ts`
  - `src/components/RealtimeVoiceChat.tsx`
  - `src/components/HomeScreen.tsx`
**Impact**: Users now stay on voice chat page and can interact immediately after connection without being redirected or disconnected

### Upload Button Functionality Fix
- **Issue**: Upload button in CourseCreationOverlay did not open OS file picker
- **Root Cause**: Button click event handling was not properly wired to file input
- **Fix**: 
  - Added `useRef` for file input element
  - Created dedicated `handleUploadClick` function
  - Removed unnecessary `Label` wrapper that was interfering with click events
  - Ensured proper button click → file input trigger flow
- **Implementation**: Direct button click handler that programmatically triggers file input

### Duplicate Course Generation Prevention (Enhanced)
- **Issue**: Multiple identical courses created per generation (2-3 duplicates)
- **Root Cause**: Race condition between Edge Function database insertion and client-side `createCourse` call
- **Fix**: 
  - **Frontend**: Removed client-side `createCourse` call since Edge Function already handles database insertion
  - **Backend**: Enhanced idempotency checking with request ID tracking
  - **Database**: Added trigger-based duplicate prevention (within 1 hour window)
- **Implementation**: 
  - Multi-layered protection: request ID tracking + recent topic checking + database triggers
  - Edge Function now returns existing course ID if duplicate detected
  - Client only calls `onCourseCreated` callback for UI updates

### Language-Aware TTS
- **Issue**: AI coach didn't speak in user's chosen language during learning
- **Root Cause**: TTS system didn't respect user's language preference
- **Solution Implemented**:
  - **Language Detection**: Integrated `useProfile` to access `languagePreference`
  - **Multi-TTS Support**: Groq TTS for supported languages, Hugging Face fallback for others
  - **Fallback Chain**: Groq → Hugging Face → Browser SpeechSynthesis
  - **New Edge Function**: Created `fallback-tts` for unsupported languages

### Authentication Enhancements
- **Email Verification**: Automatic redirect to confirmation page
- **Google OAuth**: Standard Google authentication
- **Password Reset**: Complete forgot password flow
- **Profile Consistency**: Automatic profile creation on signup

### Settings & UI Improvements
- **Responsive Design**: Mobile-first approach across all components
- **Language Selector**: Dropdown in Settings and Course Creation
- **User Naming**: First name display from full name
- **Modern UI**: Clean, consistent design patterns

### TTS Audio Playback & AI Voice Chat Fixes (Latest)
- **Issue**: Multiple critical issues affecting user experience: TTS audio playback errors, AI voice chat not responding properly, and file upload 500 errors due to payload size limits.
- **Root Cause**: 
  - **TTS Audio**: `InvalidCharacterError: Failed to execute 'atob'` due to improper base64 encoding validation
  - **AI Voice Chat**: Voice chat was using placeholder responses instead of calling actual AI service
  - **File Upload**: Payload size limits (1MB) were too restrictive for document content
- **Fix**: Comprehensive fixes for all identified issues with improved error handling and fallbacks.
- **Implementation**:
  - **TTS Audio Fix**: Added proper base64 validation, error handling, and automatic fallback to browser speech synthesis
  - **AI Voice Chat Fix**: Fixed voice chat to properly call AI service instead of placeholder responses
  - **File Upload Fix**: Increased payload size limits and improved content truncation logic
  - **Rate Limiting**: Better handling of Groq TTS rate limits with automatic fallback
  - **Error Recovery**: Graceful degradation when services fail
- **Files Modified**: 
  - `src/hooks/useTextToSpeech.ts`
  - `src/hooks/useRealtimeVoiceChat.ts`
  - `src/components/CourseCreationOverlay.tsx`
  - `supabase/functions/generate-course/index.ts`
**Impact**: Users can now properly listen to AI responses, voice chat works with real AI responses, and file uploads work without 500 errors

### Course Title & Content Cleaning for Better UX (Latest)
- **Issue**: Course titles and content were displaying technical references like "using the uploaded file", "reference document", and raw file URLs, creating a poor user experience and untidy interface.
- **Root Cause**: The AI generation was including technical context and file references in user-facing content, making the UI unprofessional and confusing.
- **Fix**: Implemented smart content cleaning that maintains AI context for better coaching while presenting clean, professional content to users.
- **Implementation**:
  - **Smart Prompt Engineering**: Enhanced prompts with clear instructions to generate clean titles without technical references
  - **Content Cleaning**: Added post-processing to remove technical details, URLs, and file references from titles and module content
  - **AI Context Preservation**: AI still gets file information for enhanced content generation but doesn't expose it in UI
  - **Professional Presentation**: Course titles and content now display clean, user-friendly information
- **Files Modified**: 
  - `src/components/CourseCreationOverlay.tsx`
  - `supabase/functions/generate-course/index.ts`
**Impact**: Users now see professional, clean course titles and content while AI maintains access to uploaded documents for better coaching quality

### Course Deletion & AI Chat Display Fixes (Latest)
- **Issue**: Multiple critical issues affecting core functionality: course deletion failing with storage.delete() errors, and AI chat displaying raw text formats and technical context making the UI untidy.
- **Root Cause**: 
  - **Course Deletion**: The database trigger was calling non-existent `storage.delete()` function, and frontend wasn't properly handling file cleanup
  - **AI Chat Display**: AI responses were including technical references, file information, and raw text formats in user-facing content
- **Fix**: Comprehensive fixes for course deletion functionality and AI chat display improvements.
- **Implementation**:
  - **Course Deletion Fix**: Fixed database trigger to use proper logging instead of non-existent functions, enhanced frontend to handle file cleanup using Supabase Storage API
  - **AI Chat Display Fix**: Added content cleaning functions to remove technical references, file information, and raw text formats from AI responses
  - **Enhanced Prompts**: Improved AI system prompts to generate cleaner, more user-friendly responses
  - **Content Processing**: Implemented both frontend and backend content cleaning for consistent user experience
- **Files Modified**: 
  - `supabase/migrations/20250823000001_create_storage_bucket_and_policies.sql`
  - `src/hooks/useCourses.ts`
  - `src/hooks/useRealtimeVoiceChat.ts`
  - `supabase/functions/realtime-voice-chat/index.ts`
**Impact**: Users can now successfully delete courses with proper file cleanup, and AI chat provides clean, professional responses without technical clutter

## Environment Variables

### Required
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

### Supabase Edge Functions
```bash
SERVICE_ROLE_KEY=your_service_role_key
```

## Deployment Instructions

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Supabase Edge Functions
1. Navigate to Supabase Dashboard > Edge Functions
2. Upload function files manually:
   - `generate-course/index.ts` (updated with enhanced idempotency)
   - `text-to-speech/index.ts`
   - `fallback-tts/index.ts`
   - `realtime-voice-chat/index.ts`
3. Set environment variables in Supabase dashboard

### Database Migrations
1. Run SQL migrations in Supabase SQL Editor:
   - `20250821090001_add_course_uniqueness.sql`
   - `20250821090002_add_language_preference.sql`
   - `20250821090003_prevent_duplicate_courses.sql` (new)

## API Endpoints

### Supabase Edge Functions
- `POST /functions/v1/generate-course` - Generate AI course (with enhanced idempotency)
- `POST /functions/v1/text-to-speech` - Groq TTS
- `POST /functions/v1/fallback-tts` - Hugging Face TTS
- `POST /functions/v1/realtime-voice-chat` - Voice chat

### External APIs
- OpenRouter API (DeepSeek R1)
- Groq TTS API (PlayAI)
- Hugging Face Inference API

## Performance Optimizations

### TTS Optimizations
- Text chunking (800 chars max per request)
- Symbol/emoji removal for natural speech
- Streaming audio playback
- Fallback chain: Groq → Hugging Face → Browser

### Course Generation
- **Enhanced Idempotency**: Request ID tracking + database triggers
- **Duplicate Prevention**: Multi-layered protection at frontend, backend, and database levels
- **Request Deduplication**: Prevent unnecessary API calls
- Loading states and user feedback
- Error handling and retry logic

### UI/UX
- Responsive design across all devices
- Loading indicators and progress feedback
- Toast notifications for user feedback
- Confirmation dialogs for destructive actions

## Troubleshooting

### Common Issues
1. **TTS Rate Limits**: Groq has daily token limits
2. **Course Duplication**: Enhanced idempotency protection prevents this
3. **Upload Button**: Now properly opens file picker on all devices
4. **Language Support**: Verify language codes and fallbacks
5. **Authentication**: Ensure email verification is enabled

### Debug Steps
1. Check browser console for errors
2. Verify environment variables
3. Test Edge Functions individually
4. Check Supabase logs for database issues
5. Monitor request IDs in course generation logs

## Future Enhancements

### Planned Features
- Additional language support
- Advanced course analytics
- Collaborative learning features
- Mobile app development
- Advanced AI models integration

### Technical Improvements
- WebSocket optimization for voice chat
- Advanced caching strategies
- Performance monitoring
- Automated testing suite

## Support & Maintenance

### Regular Tasks
- Monitor API rate limits
- Update Edge Functions as needed
- Database performance optimization
- Security updates and patches

### Monitoring
- Vercel deployment status
- Supabase function logs
- API usage and costs
- User feedback and bug reports

---

*Last Updated: August 21, 2025*
*Version: 2.1.0*
