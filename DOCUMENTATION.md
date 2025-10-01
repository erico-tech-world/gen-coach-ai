# GEN-COACH AI - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [User Guide](#user-guide)
3. [Technical Documentation](#technical-documentation)
4. [API Reference](#api-reference)
5. [Deployment Guide](#deployment-guide)
6. [Troubleshooting](#troubleshooting)

---

## Project Overview

**GEN-COACH AI** is an advanced AI-powered educational platform that revolutionizes learning through personalized course generation, interactive voice narration, and real-time AI assistance. The platform combines cutting-edge AI models with intuitive user interfaces to create an engaging, adaptive learning experience.

### Key Features
- 🤖 **AI Course Generation**: Create personalized courses using advanced AI models
- 🎤 **Multi-Model Text-to-Speech**: High-quality voice narration with multiple TTS engines
- 💬 **Real-time Voice Chat**: Interactive AI assistant with persistent memory
- 🌍 **Multi-language Support**: Support for English, French, Pidgin, Igbo, and more
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- 🔐 **Secure Authentication**: Email/password and Google OAuth integration
- 📊 **Progress Tracking**: Visual progress indicators and course management
- 🎯 **AI Avatar Narration**: Interactive course narration with session persistence

---

## User Guide

### Getting Started

#### 1. Account Creation
- **Sign Up**: Create an account using email/password or Google OAuth
- **Email Verification**: Verify your email address for account activation
- **Profile Setup**: Your profile is automatically created with your name and preferences

#### 2. Creating Your First Course
1. Click the **"Create New Course"** button on the dashboard
2. Enter your course topic or subject
3. Optionally upload supporting documents (PDF, DOC, TXT, MD)
4. Select your preferred language
5. Click **"Generate Course"** and wait for AI processing
6. Your personalized course will be created with structured modules

#### 3. Course Features

##### Course Structure
- **Title**: AI-generated professional course title
- **Modules**: Structured learning modules with clear objectives
- **Progress Tracking**: Visual progress indicators
- **Tests**: AI-generated assessments for each module
- **Resources**: YouTube links and Wikipedia references

##### Learning Modes
- **Lecture Mode**: AI avatar narrates course content with natural speech
- **Interactive Mode**: Click through modules at your own pace
- **Voice Chat**: Ask questions to the AI assistant in real-time

#### 4. Voice Features

##### AI Avatar Narration
- **Start/Pause/Resume**: Control narration playback
- **Progress Tracking**: Visual indicators show current position
- **Live Subtitles**: Real-time caption display
- **Session Persistence**: Resume from where you left off

##### Real-time Voice Chat
- **Voice Input**: Speak naturally to the AI assistant
- **Memory Persistence**: AI remembers conversation context
- **Multi-language Support**: Chat in your preferred language
- **Intelligent Responses**: Context-aware AI responses

#### 5. Settings and Preferences
- **Language Selection**: Choose from supported languages
- **Theme Toggle**: Switch between light and dark modes
- **Profile Management**: Update your name and preferences
- **Account Management**: Sign out and manage your account

### Supported Languages
- **English (en)**: Full support with all features
- **French (fr)**: Complete localization
- **Pidgin (pcm)**: Regional language support
- **Igbo (ig)**: African language support
- **Additional Languages**: 50+ languages via MeloTTS

### File Upload Support
- **Text Files**: .txt, .md
- **Documents**: .doc, .docx
- **PDFs**: .pdf
- **Maximum Size**: 5MB per file
- **Processing**: AI analyzes content to enhance course generation

---

## Technical Documentation

### Architecture Overview

GEN-COACH AI follows a modern, scalable architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Services   │
│   (React/TS)    │◄──►│   (Supabase)    │◄──►│   (APIs)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack

#### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible UI components
- **TanStack Query** for server state management
- **React Router DOM** for client-side routing
- **Lucide React** for consistent iconography

#### Backend
- **Supabase** as Backend-as-a-Service
  - PostgreSQL database with Row Level Security
  - Authentication and user management
  - Real-time subscriptions
  - Edge Functions for serverless compute
  - Storage for file uploads

#### AI/ML Services
- **OpenRouter API**: DeepSeek R1 model for course generation
- **Multi-Model TTS System**:
  - MaskGCT: Real-time, low-latency TTS
  - VibeVoice: High-quality, long-form content
  - Chatterbox: Expressive, conversational TTS
  - MeloTTS: Multilingual support (50+ languages)
  - Groq TTS: Legacy fallback
- **Hugging Face API**: Translation and fallback TTS
- **Custom Edge Functions**: Real-time voice chat and processing

### Database Schema

#### Core Tables

##### `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  language_preference VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### `courses`
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  modules JSONB DEFAULT '[]'::jsonb,
  schedule TEXT DEFAULT 'Self-paced',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  additional_details TEXT,
  youtube_links JSONB DEFAULT '[]'::jsonb,
  wikipedia_data JSONB DEFAULT '{}'::jsonb,
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### `tts_sessions`
```sql
CREATE TABLE tts_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL DEFAULT '{}',
  current_position INTEGER DEFAULT 0,
  is_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### `ai_chat_memory`
```sql
CREATE TABLE ai_chat_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Security Implementation

#### Row Level Security (RLS)
All tables implement RLS policies ensuring users can only access their own data:

```sql
-- Example RLS policy for courses
CREATE POLICY "Users can view their own courses" ON courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own courses" ON courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Authentication Flow
1. **Email/Password**: Standard Supabase Auth with email verification
2. **Google OAuth**: Third-party authentication with profile sync
3. **Session Management**: Automatic session refresh and persistence
4. **Profile Creation**: Automatic profile creation on signup

### Core Components

#### Frontend Architecture

##### Component Structure
```
src/
├── components/
│   ├── AuthPage.tsx              # Authentication interface
│   ├── HomeScreen.tsx            # Main dashboard
│   ├── CourseCreationOverlay.tsx # Course generation modal
│   ├── CourseMaterialPage.tsx   # Course viewing interface
│   ├── RealtimeVoiceChat.tsx    # Voice chat interface
│   ├── AIAvatarContainer.tsx    # AI avatar narration
│   ├── SettingsOverlay.tsx      # User settings
│   └── ui/                      # Reusable UI components
├── hooks/
│   ├── useAuth.ts               # Authentication management
│   ├── useAI.ts                 # AI course generation
│   ├── useCourses.ts            # Course data management
│   ├── useRealtimeTTS.ts        # Multi-model TTS system
│   ├── useAIVoiceChatMemory.ts  # Voice chat memory
│   └── useTextToSpeech.ts       # TTS orchestration
├── pages/
│   ├── Index.tsx                # Main application entry
│   ├── ForgotPassword.tsx       # Password reset
│   ├── ResetPassword.tsx        # Password reset confirmation
│   └── VerifyEmail.tsx          # Email verification
└── integrations/
    └── supabase/
        ├── client.ts            # Supabase client configuration
        └── types.ts             # TypeScript type definitions
```

#### Key Hooks and Their Functions

##### `useAI.ts`
- **Purpose**: Course generation using OpenRouter API
- **Features**:
  - Idempotency protection against duplicate requests
  - File context integration for enhanced content
  - Error handling and user feedback
  - Request deduplication and rate limiting

##### `useRealtimeTTS.ts`
- **Purpose**: Multi-model TTS orchestration
- **Features**:
  - Circuit breaker pattern for fault tolerance
  - Priority-based model selection
  - Token-bucket rate limiting
  - Automatic failover between models
  - Session state management

##### `useAIVoiceChatMemory.ts`
- **Purpose**: Persistent conversation memory
- **Features**:
  - Session persistence across browser refreshes
  - Message history with metadata
  - Context-aware conversation summaries
  - Search functionality within conversations

### Edge Functions

#### Course Generation (`generate-course`)
```typescript
// Main course generation function
export async function generateCourse(prompt: string, userId: string, userName: string) {
  // 1. Validate input and user authentication
  // 2. Call OpenRouter API with DeepSeek R1 model
  // 3. Process and structure course content
  // 4. Save to database with proper error handling
  // 5. Return structured course data
}
```

#### Text-to-Speech Functions
- **`maskgct-tts`**: Real-time TTS generation
- **`vibevoice-tts`**: Long-form content TTS
- **`chatterbox-tts`**: Expressive TTS
- **`melotts-tts`**: Multilingual TTS
- **`fallback-tts`**: Hugging Face fallback

#### Voice Chat (`realtime-voice-chat`)
```typescript
// Real-time voice chat processing
export async function processVoiceChat(audioData: string, sessionId: string) {
  // 1. Convert audio to text using speech recognition
  // 2. Process with AI model for response generation
  // 3. Convert response to speech
  // 4. Update conversation memory
  // 5. Return audio response
}
```

### AI Model Integration

#### Course Generation Pipeline
1. **Input Processing**: User prompt + optional file context
2. **AI Generation**: OpenRouter API with DeepSeek R1 model
3. **Content Structuring**: Parse and organize course modules
4. **Resource Enhancement**: Add YouTube links and Wikipedia data
5. **Database Storage**: Save structured course data

#### TTS Model Selection Algorithm
```typescript
// Intelligent model selection based on content and language
function selectTTSModel(text: string, language: string): TTSModel {
  // 1. Check language support for each model
  // 2. Consider content length and type
  // 3. Check circuit breaker status
  // 4. Apply priority-based selection
  // 5. Return optimal model for the request
}
```

---

## API Reference

### Supabase Edge Functions

#### `generate-course`
**Purpose**: Generate AI-powered courses using OpenRouter API

**Request**:
```typescript
{
  prompt: string;
  userId: string;
  userName: string;
  language?: string;
  fileUrl?: string;
  fileSize?: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  courseId: string;
  title: string;
  modules: CourseModule[];
  youtubeLinks: string[];
  wikipediaData: object;
}
```

#### `text-to-speech`
**Purpose**: Generate speech from text using Groq TTS

**Request**:
```typescript
{
  text: string;
  language?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  audio: string; // Base64 encoded audio
  error?: string;
}
```

#### `realtime-voice-chat`
**Purpose**: Process real-time voice chat interactions

**Request**:
```typescript
{
  audioData: string; // Base64 encoded audio
  sessionId: string;
  language?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  audioResponse: string; // Base64 encoded audio response
  transcript: string;
  error?: string;
}
```

### Database API

#### Courses Table
```typescript
// Create course
const { data, error } = await supabase
  .from('courses')
  .insert({
    user_id: userId,
    title: courseTitle,
    topic: topic,
    modules: modules,
    progress: 0
  });

// Get user courses
const { data, error } = await supabase
  .from('courses')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Update course progress
const { data, error } = await supabase
  .from('courses')
  .update({ progress: newProgress })
  .eq('id', courseId);
```

#### TTS Sessions Table
```typescript
// Save TTS session
const { data, error } = await supabase
  .from('tts_sessions')
  .upsert({
    user_id: userId,
    course_id: courseId,
    session_data: sessionData,
    current_position: position,
    is_paused: isPaused
  });

// Retrieve TTS session
const { data, error } = await supabase
  .from('tts_sessions')
  .select('*')
  .eq('user_id', userId)
  .eq('course_id', courseId)
  .single();
```

---

## Deployment Guide

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Vercel account (for frontend deployment)
- API keys for external services

### Environment Variables

#### Frontend (.env.local)
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Supabase Edge Functions
```bash
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

### Deployment Steps

#### 1. Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize project
supabase init

# Link to remote project
supabase link --project-ref your-project-ref

# Deploy database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy
```

#### 2. Frontend Deployment (Vercel)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

#### 3. Storage Configuration
```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('course-files', 'course-files', true);

-- Set up storage policies
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Edge Functions deployed
- [ ] Storage buckets created
- [ ] RLS policies enabled
- [ ] API keys secured
- [ ] Domain configured
- [ ] SSL certificates active
- [ ] Monitoring setup
- [ ] Backup strategy implemented

---

## Troubleshooting

### Common Issues

#### 1. Course Generation Fails
**Symptoms**: Course creation returns error or times out
**Solutions**:
- Check OpenRouter API key configuration
- Verify network connectivity
- Check Supabase Edge Function logs
- Ensure user authentication is valid

#### 2. TTS Not Working
**Symptoms**: No audio playback or TTS errors
**Solutions**:
- Check TTS model availability
- Verify API keys for TTS services
- Test with different TTS models
- Check browser audio permissions
- Review circuit breaker status

#### 3. Authentication Issues
**Symptoms**: Login/signup failures
**Solutions**:
- Verify Supabase configuration
- Check email verification status
- Clear browser cache and cookies
- Verify OAuth provider settings

#### 4. File Upload Problems
**Symptoms**: Files not uploading or processing
**Solutions**:
- Check file size limits (5MB max)
- Verify supported file formats
- Check storage bucket configuration
- Review RLS policies for storage

#### 5. Voice Chat Issues
**Symptoms**: Voice chat not responding
**Solutions**:
- Check microphone permissions
- Verify audio input/output devices
- Test with different browsers
- Check Edge Function logs
- Verify session persistence

### Debug Mode

#### Enable Debug Logging
```typescript
// In development, enable detailed logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug mode enabled');
  // Add detailed logging for debugging
}
```

#### Supabase Debug
```bash
# Check Edge Function logs
supabase functions logs --follow

# Check database logs
supabase db logs

# Test Edge Functions locally
supabase functions serve
```

### Performance Monitoring

#### Key Metrics to Monitor
- **Response Times**: API response times
- **Error Rates**: Failed requests percentage
- **User Engagement**: Active users and session duration
- **Resource Usage**: CPU, memory, and storage
- **TTS Performance**: Audio generation times
- **Course Generation**: Success rates and processing times

#### Monitoring Tools
- **Supabase Dashboard**: Built-in monitoring
- **Vercel Analytics**: Frontend performance
- **Custom Logging**: Application-specific metrics
- **Error Tracking**: Sentry or similar service

### Support and Maintenance

#### Regular Maintenance Tasks
- **Database Optimization**: Regular VACUUM and ANALYZE
- **Log Cleanup**: Archive old logs and clean up storage
- **Security Updates**: Keep dependencies updated
- **Performance Review**: Monitor and optimize slow queries
- **Backup Verification**: Test backup and recovery procedures

#### Getting Help
- **Documentation**: Refer to this comprehensive guide
- **Community**: Join Supabase and Vercel communities
- **Support**: Contact platform support for infrastructure issues
- **GitHub Issues**: Report bugs and feature requests

---

## Conclusion

GEN-COACH AI represents a cutting-edge approach to AI-powered education, combining advanced machine learning models with intuitive user interfaces. The platform's architecture is designed for scalability, reliability, and user experience, making it suitable for both individual learners and educational institutions.

The comprehensive documentation provided here covers all aspects of the platform, from user guides to technical implementation details. This ensures that both end-users and developers can effectively utilize and maintain the system.

For additional support or questions, please refer to the troubleshooting section or contact the development team.

---

*Last Updated: January 2025*
*Version: 2.0.0*
