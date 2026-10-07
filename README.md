# PrepSim / VivaSim — AI Oral Exam & Technical Mock Interview Simulator

> **PrepSim / VivaSim** is a state-of-the-art AI-powered oral examination and technical interview simulator built with **Next.js 16 (App Router)** and **React 19**. It features adaptive question generation via **Gemini AI**, neural text-to-speech with **ElevenLabs**, dynamic SVG animated examiner avatars, real-time acoustic/lexical telemetry, and comprehensive post-session diagnostic analytics.

---

## 🌟 Key Features

### 1. 🎓 Dual Examination Modes
- **Academic Mode (Viva Voce)**: Simulates a university oral exam focusing on core definitions, physical laws, mathematical formulas, and academic rigor.
- **Professional Mode (Mock Interview / Bar Raiser)**: Simulates a high-stakes corporate engineering interview focusing on STAR format responses, system architecture trade-offs, edge cases, and industry standards.

### 2. 🎭 4 Examiner Personalities & Dynamic SVG Avatars
Choose between four distinct examiner personas, each equipped with custom speech patterns, vocal traits, and real-time SVG facial expression states (*Speaking, Listening, Thinking, Stern, Intimidated, Impressed, Surprised*):
- **Dr. George / Warm Recruiter**: Patient, encouraging, and supportive tone.
- **Daniel / Strict Tech Lead**: Structured, precise, and probing.
- **Adam / Brutal Staff Engineer**: Direct, challenging, and unyielding on technical flaws.
- **Professor Thorne / Director Bar Raiser**: Intimidating, rapid-fire, and high-pressure examiner.

### 3. 🧠 Chain-of-Thought (CoT) & Rubric Answer Evaluation
- **Step-by-Step Rationale**: Evaluates answers systematically using auto-regressive Chain-of-Thought reasoning before assigning scores to eliminate score variance and hallucinations.
- **Multi-Dimensional Metrics**: Grades responses across *Correctness, Accuracy, Completeness, Articulation/Clarity, Nervousness, Confidence,* and *Hesitation*.
- **Strengths & Gaps Badges**: Displays green badges (`✓`) for accurate concepts and amber badges (`⚠`) for missing trade-offs or technical inaccuracies.
- **Canonical Answer Benchmarks**: Generates exemplar answers for every question to guide revision.

### 4. ⚡ Real-Time Lexical & Acoustic Telemetry
- **Live Voice Prosody**: Monitors speech volume, speaking rate (WPM), filler word count (`um`, `uh`, `basically`, etc.), and hesitation pauses in real-time.
- **Speech Recognition (STT)**: Built-in Web Speech API integration with auto-restart and microphone volume visualization.
- **Intervention Tools**: Ask for hints, request simpler sub-questions, or skip questions mid-viva.

### 5. 📊 Hindsight Retrospective Engine
- **Cross-Round Analysis**: Evaluates the entire completed exam to detect overarching performance patterns.
- **Confidence Trajectory**: Maps momentum shifts across the session (*Ascending, Declining, Steady*).
- **Anti-Bluffing & Contradiction Detection**: Identifies sessions where high verbal confidence masked low factual accuracy or where answers contradicted prior rounds.

### 6. 🗺️ Interactive Syllabus Mind Map & Target Drills
- **Syllabus Ingestion**: Upload custom PDF or TXT syllabus files (powered by client-side PDF.js), paste raw job descriptions, or expand any topic with AI.
- **Visual Mind Map**: Explore topics node-by-node with visual mastery progress indicators.
- **Target Micro-Drills**: Select any specific unit or subtopic to launch a focused 3-question micro-drill.

### 7. 🎴 High-Yield AI Flashcards & Review
- Generates 5 high-yield study flashcards based on the candidate's syllabus for rapid post-exam review.

### 8. 🔐 Authentication & Data Persistence
- **Firebase Integration**: Google OAuth and Email/Password authentication backed by Firestore Cloud Database.
- **Guest Mode**: Full offline capability using LocalStorage with seamless 1-click cloud sync upon signing in.
- **Automatic Stats Reconciliation**: Recalculates user performance analytics directly from actual session records to prevent stale or corrupted stats.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | Next.js 16.2.6 (Turbopack) | App Router & serverless API routes |
| **UI Library** | React 19.2.4 | Client components & dynamic state management |
| **AI Intelligence** | Gemini AI (`v1beta`) | Adaptive questions, CoT evaluations, syllabus parsing |
| **Voice Synthesis** | ElevenLabs REST API | Neural text-to-speech (`eleven_flash_v2_5`) |
| **TTS Fallback** | Web Speech API | Browser-native audio synthesis fallback |
| **Database & Auth** | Firebase 12.13.0 | Firestore cloud storage & auth state persistence |
| **PDF Extraction** | PDF.js 3.4.120 | Client-side syllabus text extraction |
| **Styling** | Vanilla CSS | Custom CSS variables, dark-mode theme, glassmorphism UI |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** / **pnpm** / **bun**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/keshav2232/viva-s.git
cd viva-semulator
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Gemini AI Key (Required for AI generation & evaluation)
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs Speech Key (Optional — falls back to Web Speech API if omitted)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Firebase Configuration (Optional — guest mode works fully without Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 📂 Project Structure

```
viva-semulator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── viva/
│   │   │       └── route.js           # Server API route (generate, evaluate, TTS, hindsight)
│   │   ├── globals.css                # Global design system & theme tokens
│   │   ├── layout.js                  # App root layout & AuthProvider wrapper
│   │   └── page.js                    # SPA state machine & view router
│   ├── components/
│   │   ├── ActiveViva.jsx             # Live examination engine & telemetry
│   │   ├── AuthScreen.jsx             # Landing page & authentication UI
│   │   ├── Dashboard.jsx              # User home screen, stats & past session list
│   │   ├── ExaminerAvatar.jsx         # Dynamic animated SVG portrait engine
│   │   ├── Header.jsx                 # Top navigation bar & auth menu
│   │   ├── Results.jsx                # Post-exam scorecard & diagnostics
│   │   └── SetupFlow.jsx              # 3-step wizard & Mind Map preview
│   ├── context/
│   │   └── AuthContext.js             # Firebase auth context & Firestore synchronization
│   ├── services/
│   │   ├── AnswerEvaluationService.js # Hybrid CoT / acoustic answer evaluation
│   │   ├── HindsightEngine.js         # Post-session retrospective cross-round analysis
│   │   ├── PDFExtractionService.js    # Client PDF syllabus text extraction
│   │   ├── QuestionGraphEngine.js     # Adaptive question orchestrator & local fallback
│   │   ├── SessionContextManager.js   # In-memory session state manager
│   │   ├── SyllabusParserService.js   # Syllabus structure parsing service
│   │   ├── speechManager.js           # Real-time Speech-to-Text (STT) manager
│   │   └── voiceManager.js            # ElevenLabs & Web Speech TTS manager
│   └── utils/
│       └── mockData.js                # Persona configs & pre-seeded syllabus presets
└── package.json
```

---

## 🛡️ Offline Resilience
PrepSim includes a **resilient rule-based offline fallback engine**. If `GEMINI_API_KEY` is not supplied or network connectivity drops:
- Pre-seeded question graphs for *Thermodynamics, Data Structures, Machine Design, Computer Networks,* and *Marketing Management* ensure uninterrupted viva sessions.
- Local delivery metrics calculate WPM, filler word penalties, and hesitation scores client-side.
- Web Speech API synthesizes examiner voice responses locally.

---

## 📄 License
This project is proprietary software for AI oral examination and technical interview preparation.
