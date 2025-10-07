# GEN-COACH AI

<div align="center">
  <img src="public/GenCoachImg.png" alt="GEN-COACH AI Logo" width="200" height="200">
  
  **AI-Powered Educational Platform with Voice Narration**
  
  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/gen-coach-ai)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
  [![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
</div>

## 🚀 Overview

GEN-COACH AI is an advanced AI-powered educational platform that revolutionizes learning through personalized course generation, interactive voice narration, and real-time AI assistance. The platform combines cutting-edge AI models with intuitive user interfaces to create an engaging, adaptive learning experience.

### ✨ Key Features

- 🤖 **AI Course Generation**: Create personalized courses using advanced AI models (DeepSeek R1)
- 🎤 **Multi-Model Text-to-Speech**: High-quality voice narration with multiple TTS engines
- 💬 **Real-time Voice Chat**: Interactive AI assistant with persistent memory
- 🌍 **Multi-language Support**: Support for English, French, Pidgin, Igbo, and 50+ languages
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- 🔐 **Secure Authentication**: Email/password and Google OAuth integration
- 📊 **Progress Tracking**: Visual progress indicators and course management
- 🎯 **AI Avatar Narration**: Interactive course narration with session persistence

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **TanStack Query** for data fetching
- **React Router DOM** for routing

### Backend
- **Supabase** (PostgreSQL, Auth, Storage, Edge Functions)
- **OpenRouter API** (DeepSeek R1 model for course generation)
- **Multi-Model TTS System** with automatic failover:
  - MaskGCT (real-time, Hugging Face)
  - VibeVoice (long-form, Hugging Face)
  - Chatterbox (expressive, Hugging Face)
  - MeloTTS (multilingual, Hugging Face)
  - Groq TTS (server fallback, WAV)
  - Browser Speech Synthesis (final local fallback)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- API keys for external services

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/gen-coach-ai.git
   cd gen-coach-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📖 Usage

### Creating Your First Course

1. **Sign up** for an account using email/password or Google OAuth
2. **Click "Create New Course"** on the dashboard
3. **Enter your course topic** or subject
4. **Optionally upload** supporting documents (PDF, DOC, TXT, MD)
5. **Select your preferred language**
6. **Click "Generate Course"** and wait for AI processing
7. **Start learning** with AI avatar narration or interactive mode

### Voice Features

- **AI Avatar Narration**: Listen to course content with natural speech
- **Real-time Voice Chat**: Ask questions to the AI assistant
- **Session Persistence**: Resume from where you left off
- **Multi-language Support**: Learn in your preferred language

## 🔧 Configuration

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
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup

1. **Create a new Supabase project**
2. **Run database migrations** (see `supabase/migrations/`)
3. **Deploy Edge Functions** (see `supabase/functions/`)
4. **Configure storage buckets** for file uploads
5. **Set up Row Level Security (RLS) policies**

## 📁 Project Structure

```
gen-coach-ai/
├── src/
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   ├── integrations/       # External service integrations
│   └── lib/                # Utility functions
├── supabase/
│   ├── functions/          # Edge Functions
│   └── migrations/         # Database migrations
├── public/                 # Static assets
└── docs/                   # Documentation
```

## 🚀 Deployment

### Frontend (Vercel)

1. **Connect your GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy automatically** on push to main branch

### Supabase

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy
   ```

2. **Run database migrations**:
   ```bash
   supabase db push
   ```

3. **Configure storage buckets** and policies

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

## 📚 Documentation

- **[Complete Documentation](DOCUMENTATION.md)** - Comprehensive guide for users and developers
- **[API Reference](DOCUMENTATION.md#api-reference)** - Detailed API documentation
- **[Deployment Guide](DOCUMENTATION.md#deployment-guide)** - Step-by-step deployment instructions
- **[Troubleshooting](DOCUMENTATION.md#troubleshooting)** - Common issues and solutions

## 🐛 Troubleshooting

### Common Issues

1. **Course Generation Fails**
   - Check OpenRouter API key configuration
   - Verify network connectivity
   - Check Supabase Edge Function logs

2. **TTS Not Working**
   - Check TTS model availability and API keys
   - Hugging Face failures auto-fallback to Groq; Groq 429 auto-fallback to browser speech
   - Confirm browser can autoplay audio (user interaction may be required)
   - Inspect Network → Response for `audio`/`audioContent` and `contentType`

3. **Authentication Issues**
   - Verify Supabase configuration
   - Check email verification status
   - Clear browser cache and cookies

For more detailed troubleshooting, see our [Documentation](DOCUMENTATION.md#troubleshooting).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenRouter** for AI model access
- **Supabase** for backend infrastructure
- **Vercel** for deployment platform
- **shadcn/ui** for UI components
- **Tailwind CSS** for styling

## 📞 Support

- **Documentation**: [DOCUMENTATION.md](DOCUMENTATION.md)
- **Issues**: [GitHub Issues](https://github.com/your-username/gen-coach-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/gen-coach-ai/discussions)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=your-username/gen-coach-ai&type=Date)](https://star-history.com/#your-username/gen-coach-ai&Date)

---

<div align="center">
  <p>Made with ❤️ by the GEN-COACH AI Team</p>
  <p>
    <a href="https://github.com/your-username/gen-coach-ai">⭐ Star this repo</a> •
    <a href="https://github.com/your-username/gen-coach-ai/issues">🐛 Report Bug</a> •
    <a href="https://github.com/your-username/gen-coach-ai/issues">💡 Request Feature</a>
  </p>
</div>