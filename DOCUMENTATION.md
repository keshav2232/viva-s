# VivaSim — Complete Technical Documentation

> **VivaSim** is a premium AI-powered oral examination (Viva Voce) simulator built on Next.js 16. It uses Gemini AI for adaptive question generation, ElevenLabs for neural text-to-speech, and Firebase for cloud authentication and data persistence. Students can practice viva exams with four distinct AI examiner personalities, receive real-time biometric feedback, and visualize their syllabus as an interactive mind map.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Environment Configuration](#4-environment-configuration)
5. [Authentication System](#5-authentication-system)
6. [Application Routing & State Machine](#6-application-routing--state-machine)
7. [Feature 1 — Exam Setup Flow & Syllabus Ingestion](#7-feature-1--exam-setup-flow--syllabus-ingestion)
8. [Feature 2 — Interactive AI Examiner (Active Viva)](#8-feature-2--interactive-ai-examiner-active-viva)
9. [Feature 3 — Dynamic Examiner Avatars](#9-feature-3--dynamic-examiner-avatars)
10. [Feature 4 — Speech Recognition & Submission](#10-feature-4--speech-recognition--submission)
11. [Feature 5 — Voice Synthesis (TTS)](#11-feature-5--voice-synthesis-tts)
12. [Feature 6 — Post-Viva Results & Diagnostics](#12-feature-6--post-viva-results--diagnostics)
13. [Feature 7 — Interactive Syllabus Mind Map & Target Drills](#13-feature-7--interactive-syllabus-mind-map--target-drills)
14. [The API Route — /api/viva](#14-the-api-route--apiviva)
15. [Services Reference](#15-services-reference)
16. [Components Reference](#16-components-reference)
17. [Data Models](#17-data-models)
18. [Firebase Database Schema](#18-firebase-database-schema)
19. [Offline Fallback Architecture](#19-offline-fallback-architecture)
20. [Score Calculation Algorithms](#20-score-calculation-algorithms)
21. [Examiner Personalities](#21-examiner-personalities)
22. [Design System & CSS Architecture](#22-design-system--css-architecture)
23. [Hindsight Retrospective Analysis](#23-hindsight-retrospective-analysis)

---

## 1. Project Overview

VivaSim solves a critical gap in academic preparation — students rarely get to practice *speaking* their answers aloud under realistic examination pressure. It simulates a full oral exam with:

- **Adaptive AI questioning** that branches based on student performance
- **Four examiner personalities** from friendly to terrifying, with distinct voices and facial expressions
- **Background biometric monitoring** (confidence, nervousness, hesitation, WPM) calculated in real-time as you speak
- **Syllabus-grounded questions** from uploaded PDFs, TXT files, or AI-expanded topics
- **Interactive mind map** for visual curriculum navigation and targeted micro-drills
- **Post-viva scorecard** with emotion timeline, speech fluency diagnostics, and weakness analysis
- **Dual storage modes**: Cloud (Firebase Firestore) for signed-in users, LocalStorage for guest sessions

---

## 2. Tech Stack & Dependencies

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.2.6 | Framework with Turbopack, App Router, server-side API routes |
| **React** | 19.2.4 | UI component rendering |
| **Firebase** | 12.13.0 | Auth (Email + Google) + Firestore database |
| **Gemini AI** | REST API | Adaptive question generation, syllabus parsing, answer evaluation |
| **ElevenLabs** | REST API | Neural text-to-speech (eleven_flash_v2_5 model) |
| **PDF.js** | 3.4.120 | Client-side PDF syllabus text extraction (loaded via CDN) |
| **Web Speech API** | Browser native | Speech recognition (STT) fallback |
| **Web Audio API** | Browser native | Real-time microphone volume visualization |
| **MediaRecorder API** | Browser native | Audio blob capture (used for local duration-based prosody estimation) |

---

## 3. Project Structure

```
viva-semulator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── viva/
│   │   │       └── route.js          ← Server-side POST handler (5 actions)
│   │   ├── globals.css               ← Entire design system + component styles
│   │   ├── layout.js                 ← Root layout, AuthProvider wrapper
│   │   ├── page.js                   ← App shell, routing state machine, score logic
│   │   └── page.module.css           ← Supplementary scoped styles
│   ├── components/
│   │   ├── ActiveViva.jsx            ← Core exam engine (1075 lines)
│   │   ├── AuthScreen.jsx            ← Login/signup UI
│   │   ├── Dashboard.jsx             ← Home screen, stats, session list
│   │   ├── ExaminerAvatar.jsx        ← Dynamic SVG portrait engine (497 lines)
│   │   ├── Header.jsx                ← Navigation bar
│   │   ├── Results.jsx               ← Post-viva scorecard (1042 lines)
│   │   └── SetupFlow.jsx             ← 3-step setup wizard (990 lines)
│   ├── context/
│   │   └── AuthContext.js            ← Firebase auth context + Firestore CRUD
│   ├── services/
│   │   ├── AnswerEvaluationService.js ← Hybrid local/Gemini answer grader
│   │   ├── PDFExtractionService.js   ← PDF.js CDN loader + file text extraction
│   │   ├── QuestionGraphEngine.js    ← API caller + rule-based offline fallback
│   │   ├── SessionContextManager.js  ← In-memory session state tracker
│   │   ├── SyllabusParserService.js  ← Heuristic + Gemini syllabus parser
│   │   ├── firebase.js               ← Firebase SDK init, guarded by env check
│   │   ├── speechManager.js          ← STT engine with auto-restart + volume analysis
│   │   └── voiceManager.js           ← TTS engine with ElevenLabs + Web Speech fallback
│   └── utils/
│       └── mockData.js               ← Personality definitions, demo sessions, ADAPTIVE_VIVAS
├── .env.local                        ← API keys (never committed)
├── next.config.mjs                   ← Minimal config
└── package.json
```

---

## 4. Environment Configuration

Create a `.env.local` file at the project root:

```env
# Gemini AI (Google)
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Firebase (Client SDK — publicly safe)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

> **Offline Fallback**: If `GEMINI_API_KEY` is absent, the app switches to a fully local rule-based engine. No crash. Questions use pre-seeded templates for Thermodynamics, Data Structures, Machine Design, and any other topic via generic fallback trees.

---

## 5. Authentication System

**File**: `src/context/AuthContext.js`

### Auth Modes

| Mode | Description | Data Storage |
|---|---|---|
| **Firebase Email** | Sign up / log in with email + password | Firestore cloud |
| **Firebase Google** | OAuth popup via Google provider | Firestore cloud |
| **Guest (Offline)** | Bypasses Firebase entirely, name stored in localStorage | localStorage |

### Key Functions

- **`signupWithEmail(email, password, fullName)`** — Creates Firebase user, sets displayName, initializes Firestore docs
- **`loginWithEmail(email, password)`** — Standard Firebase signIn
- **`loginWithGoogle()`** — signInWithPopup — account chooser dialog
- **`logout()`** — Firebase signOut, clears context
- **`addSessionToCloud(newSessionData, updatedStatsData)`** — Writes completed viva session to Firestore, updates state optimistically
- **`syncGuestData()`** — Batch-uploads all localStorage sessions/stats to Firestore, then clears localStorage
- **`loadUserData(uid, displayName)`** — On login: loads sessions (ordered by createdAt desc), reconciles stats from actual session data

### Stats Reconciliation

When a user logs in, stats are **recalculated from actual session data** (not read from a stored stats doc blindly). This prevents stale or injected mock data from leaking into the cloud stats view. The reconciled stats are then written back to Firestore if different.

### Landing Page & Portal Access UI

The portal access interface (`src/components/AuthScreen.jsx`) serves both as the informative marketing landing page and the entry gate:
- **Call-to-Action Buttons**: Marketing landing buttons (e.g. hero CTA, sticky header action, bottom section CTA) are labeled as **"Get Started"** for a clear, direct conversion funnel.
- **Responsive Mobile Layout**: On narrow screens (`max-width: 640px`), the header aligns elements dynamically to the edges, and the top auth navigation links are reorganized:
  - Replaces the desktop pipe-separated navigation (`← Read Practice Presets | New to PrepSim? Create account`) with a clean, responsive flex row displaying a simple `← Back` link and an `auth-nav-toggle` button aligned side-by-side.

---

## 6. Application Routing & State Machine

**File**: `src/app/page.js`

The app is a **single-page application** with a manual `activeScreen` state variable routing between five screens:

```
"auth-screen" → shown when user=null AND isGuest=false
     ↓
"dashboard"   → default home; shows stats, sessions, Start New Viva button
     ↓
"setup"       → 3-step wizard (syllabus → config → preview/mind map)
     ↓
"active-viva" → live exam engine (timer, avatar, STT, TTS)
     ↓
"results"     → post-exam scorecard, emotion timeline, speech diagnostics
```

**Auth loading state**: Shows an animated skeleton loader with the VivaSim logo while Firebase resolves the initial auth state.

**Guest data sync banner**: When a logged-in user has orphaned localStorage data from previous guest sessions, a dismissible banner prompts one-click cloud migration.

### Score Calculation Formula

```js
score = (confidenceAvg × 0.4) + (clarityAvg × 0.6)
        - (hesitationAvg × 0.1) - (nervousnessAvg × 0.1) + 12

// Clamped to [40, 99]
// If endedEarly: score = score × 0.6
```

---

## 7. Feature 1 — Exam Setup Flow & Syllabus Ingestion

**File**: `src/components/SetupFlow.jsx`

### Step 1: Syllabus Source

Two modes:

#### A. Upload Syllabus (File)
- Drag-and-drop zone accepts **PDF**, **TXT**, and **MD** files
- On drop/select: `PDFExtractionService.extractText(file)` is called
  - PDF: loads `pdf.js` from CDN (lazy-loaded once), iterates all pages, concatenates text
  - TXT/MD: simple `FileReader.readAsText`
- Extracted text is then sent to **Gemini** via `SyllabusParserService.parseSyllabusRemote(rawText)` → `/api/viva` action `"parse-syllabus"`
- Gemini parses the raw text and returns a structured `{ topic, units: [{ name, topics[] }] }` tree
- Fallback: If Gemini unavailable, `SyllabusParserService.parseSyllabus(rawText)` runs a client-side **regex heuristic** matching `Unit N:`, `Module N:`, `Chapter N:`, `Section N:` patterns

#### B. Enter Topic Name
- Free-text input or quick-pick suggestion pills (Thermodynamics, Data Structures, Machine Design, Computer Networks, Marketing Management)
- On proceed: `SyllabusParserService.expandTopicTree(topic)` → `/api/viva` action `"expand-topic"` → Gemini generates exactly 3 units × 3-4 subtopics

### Step 2: Examination Configuration

| Setting | Options |
|---|---|
| **Duration** | 5, 10, 15, 20 minutes, or Custom (1–60 min) |
| **Last-Minute Mode** | Toggle: focuses on high-yield basics only |
| **Mock External Viva** | Toggle: aggressive grading, intimidation framing |
| **Examiner Personality** | Friendly / Strict / Brutal / Viva Terror |
| **Voice Sample** | Play a personality voice clip via `VoiceManager.speak()` |

#### Examiner Personality Select on Mobile
- Touch interfaces lack hover states, which previously hid the character descriptions on personality cards.
- A dedicated **info button** (`.info-btn-mobile`) was added on the top right of each personality card.
- Tapping this button toggles a glassmorphic overlay (`.personality-details-overlay`) directly on top of the selected card to display its character attributes (Patience, Grading aggressiveness, and detailed profile description).

### Step 3: Preview — Mind Map & Configuration Review

Shows:
- Interactive SVG mind map **or** outline list view (toggleable)
- Focus Target Drill engagement panel (if subtopic selected)
- Exam parameters summary grid (Examiner, Duration, Scope, Pedagogical Guard)
- Begin Exam / Begin Target Drill action button

---

## 8. Feature 2 — Interactive AI Examiner (Active Viva)

**File**: `src/components/ActiveViva.jsx`

### State Machine

The exam follows a deterministic state machine with 5 states:

```
"intro" → "speaking" → "listening" → "analyzing" → "generating" → "speaking" (loop × 4)
                                                                        ↓ (after Q4)
                                                                    "finished"
```

| State | What Happens |
|---|---|
| `intro` | SessionContextManager reset; first question generated; examiner greets student |
| `speaking` | ElevenLabs TTS plays; waveform animates; background STT watches for interruptions (strict/brutal/terror) |
| `listening` | SpeechManager active; background biometric tracker updates metrics every 350ms; 7.5s silence timer ticking |
| `analyzing` | Answer submitted; Gemini/local evaluator scores response; avatar shows eval reaction |
| `generating` | Next question fetched from Gemini or fallback; preloaded to cache |

### Audio Safety Pre-Unlock Flow
Modern mobile and desktop browsers enforce strict autoplay policies that block programmatically triggered text-to-speech (TTS) audio until an explicit user interaction occurs.
- To prevent silent questions or early failsafe fallbacks, `ActiveViva` implements a gateway state governed by `sessionUnlocked` (boolean).
- Before entering the `"intro"` state or restoring a paused session, the component renders a full-screen **"Start/Resume Session"** card overlay.
- Clicking the action button triggers a dummy `SpeechSynthesisUtterance("")` on the `window.speechSynthesis` object, programmatically unlocking the browser's audio channel.
- Once unlocked (`sessionUnlocked` is set to `true`), the actual viva simulation, timer interval, and voice generation flow automatically launch.

### Question Flow (4 questions per viva)

1. **triggerIntroduction()**: Generates Q1 with `QuestionGraphEngine.generateNextQuestion()`, prepends a personality-specific greeting, speaks it via TTS
2. After silence (7.5s) or manual submit: **processResponse()** is called
3. Answer is evaluated by `AnswerEvaluationService.evaluateResponse()`
4. Result recorded in `SessionContextManager.recordRound()`
5. After 3.2 second reaction delay (avatar shows pleased/stern expression), Q2 is generated with full conversation history
6. Repeat until `currentQuestionIndex >= 4`, then `handleFinish()`

### Exam Interruption Feature (Non-Friendly Personalities)

For Strict, Brutal, and Terror personalities:
- During TTS playback, `startBackgroundListeningForInterruptions()` runs a passive STT listener
- If student speaks more than 8 characters while examiner is talking: `handleExaminerInterruption()` fires
- The examiner says a personality-appropriate rebuke, then repeats the question

### Pause & Resume

- **Pause**: Entire exam state serialized to `localStorage["vivasim_paused_session"]` including all SessionContextManager arrays, current question, and config
- **Resume**: On dashboard, a banner prompts resume. The `config.isResume = true` flag causes `ActiveViva` to restore state and repeat the interrupted question via TTS

### Timer
- Countdown from `config.duration × 60` seconds
- Updates every second via `setInterval`
- At 0: alerts student and calls `handleFinish(false)` (ended on time, not early)

### Report Compilation
`handleFinish()` calls:
- `SessionContextManager.compileFinalReport(config.topic)`
- Generates `dynamicStrengths`, `dynamicWeaknesses`, `dynamicRevisions` from per-topic metrics
- Passes full report to `onFinishViva()` callback in `page.js`

---

## 9. Feature 3 — Dynamic Examiner Avatars

**File**: `src/components/ExaminerAvatar.jsx`

### Four Distinct SVG Personas

| Persona | Personality | Visual Traits |
|---|---|---|
| **Dr. George Abernathy** | Friendly | Yellow-toned face, grey wavy hair, round wire specs, rosy cheeks, warm baseline smile |
| **Dr. Daniel Sterling** | Strict | Pink-toned face, sleek parted dark hair, rectangular silver specs, blue academic tie |
| **Dr. Adam Vance** | Brutal | Tan face, spiky grey hair, sharp octagonal orange-frame glasses, chiseled jaw, asymmetric eyebrows |
| **Prof. Harry Thorne** | Terror | Red-toned face, white spiky hair, massive dark beard, glowing red irises, menacing shadow over brow |

### Mood Engine (useMemo)

The avatar computes a `currentMood` from three inputs:
1. `vivaState` (speaking/listening/analyzing/generating)
2. `lastEvaluation` (from Gemini grading: correctness score + tag)
3. `liveMetrics` (confidence, nervousness, hesitation from live STT tracker)

| Mood | Trigger | Visual Effect |
|---|---|---|
| `speaking` | vivaState === "speaking" | Mouth opens to animated curve |
| `thinking` | vivaState === "analyzing/generating" | Eyebrows furrow inward, small flat mouth |
| `eval-pleased` | correctness >= 75 | Wide smile, raised brows (nod animation) |
| `eval-stern` | correctness < 55 or tag === "Bluffing" | Deep frown, intense downslant brows (shake animation) |
| `eval-skeptical` | tag === "Incomplete" | Wavy mouth, asymmetric brow raise |
| `listening-pleased` | confidence > 80 and hesitation < 15 | Smile, raised brows |
| `listening-skeptical` | nervousness > 45 or hesitation > 35 | Narrowed eyes, one high brow |

### Dynamic Parameters

All facial features respond to a second `useMemo` computing SVG path `d` attributes:
- **`mouthPath`**: Bezier quadratic SVG path string — neutral, smile, frown, or wavy
- **`eyebrowRotationL/R`**: CSS `rotate()` degrees applied per eyebrow
- **`eyebrowTranslationY`**: Vertical shift for raised/lowered brows
- **`eyeScaleY`**: Vertical squint scale for skeptical/stern moods

Brutal's left eyebrow and Terror's brows have **extra hardcoded default offsets** applied on top of mood transforms, so they always look intense at rest.

---

## 10. Feature 4 — Speech Recognition & Submission

**File**: `src/services/speechManager.js`

### Browser STT Engine

Uses the `Web Speech API` (`SpeechRecognition` / `webkitSpeechRecognition`) with:
- `continuous = true` — keeps listening between pauses
- `interimResults = true` — shows live partial transcripts as student speaks

### Auto-Restart (Hot Restart)

Browsers forcibly stop speech recognition after silence (~15s). SpeechManager handles this:
- `shouldBeActive` flag tracks intent
- On `onend` event, if `shouldBeActive=true` AND no fatal error: schedules a 150ms restart
- `isHotRestarting=true` prevents transcript from being cleared during restart

### Silence Submission Timer

`silenceThresholdMs = 7500` (7.5 seconds):
- Reset every time a new speech result arrives
- On expiry: calls `onSilenceDetected(finalTranscript)` → `processResponse()` in ActiveViva

### Volume Visualization

After starting, a `getUserMedia` stream is connected to a `Web Audio API` `AnalyserNode`:
- `fftSize = 32`
- Every 80ms, reads byte frequency data, averages it, normalizes to 0–100%
- Calls `onVolumeChange(pct)` which drives the waveform bars in the ActiveViva UI

### MediaRecorder (Audio Blob)

Simultaneously records audio as a WebM blob:
- `MediaRecorder` with `mimeType: "audio/webm"` collects chunks
- On stop: blob assembled, `onAudioCaptured(blob)` fires → `handleHumeEmotionAnalysis()`
- The blob is sent to `/api/viva` with `action: "analyze-hume-emotion"`, but **no external Hume API call is made** — see the Hume AI note below

### Error Handling
- `not-allowed` / `service-not-allowed` / `not-supported`: activates keyboard fallback
- `no-speech`: **silently ignored** — SpeechManager restarts to protect already-captured text

---

## 11. Feature 5 — Voice Synthesis (TTS)

**File**: `src/services/voiceManager.js`

### Architecture: Two-tier with Preloading

```
ElevenLabs API (primary)
    ↓ (if fails or unavailable)
Browser Web Speech API (failsafe)
```

### ElevenLabs Voice Mapping

| Personality | Voice ID | Character |
|---|---|---|
| friendly | JBFqnCBsd6RMkjVDRZzb | George |
| strict | onwK4e9ZLuTAKqWW03F9 | Daniel |
| brutal | pNInz6obpgDQGcFmaJgB | Adam |
| terror | SOYHLrjzK2X1ezoPC6cr | Harry |

**Voice settings**:
- `stability`: 0.65 (friendly/strict) / 0.38 (brutal/terror) — lower = more emotional, expressive, breathy
- `similarity_boost`: 0.75 for all
- Model: `eleven_flash_v2_5` (low latency)

### Preloading

`VoiceManager.preload(text, personality)` is called as soon as the next question is known (while the current question speech is still playing). The fetched audio blob is stored as an `ObjectURL` in `preloadedCache`. When `speak()` is called, it serves from cache instantly.

### Speak ID System

Each `speak()` call generates a unique `speakId`. All async callbacks (`onplay`, `onended`, `onerror`) check `activeSpeakId === speakId` before firing. If `stop()` was called (or a new `speak()` started), the superseded call aborts silently.

### Failsafe: Web Speech API

If ElevenLabs fails, `isFailsafeMode = true` and all subsequent calls skip directly to `triggerFailsafeFallback()`:
- `SpeechSynthesisUtterance` with personality-adjusted `rate` and `pitch`
- Preferred voices: Google UK English Male/Female, Microsoft David, natural voices
- Failsafe timeout: `(wordCount × 380) + 3000ms` to force `onEnd` if browser never fires it

---

## 12. Feature 6 — Post-Viva Results & Diagnostics

**File**: `src/components/Results.jsx`

### Left Panel — Performance Scorecard

Six metrics displayed as horizontal bar charts:

| Metric | Derived From |
|---|---|
| Subject Understanding | Average correctness from all question evaluations |
| Vocal Confidence | Average confidence from biometric tracker |
| Clarity of Communication | Average clarity (hybrid: 40% local + 60% Gemini) |
| Conceptual Depth | Average completeness from Gemini |
| Handling Pressure | Average (100 - nervousness) |
| Consistency | Inverse of standard deviation of correctness scores across questions |

### Right Panel — Two Tab Views

#### Tab 1: Emotion Timeline

- Interactive Q×Q slider (click question number to jump)
- Per-question radar-style metrics: Confidence, Clarity, Nervousness, Hesitation, Correctness, Accuracy
- Transcript replay panel with expand/collapse
- TTS replay button for each question (speaks examiner question aloud again)

#### Tab 2: Speech & Fluency Diagnostics

**Lexical Filler Word Analysis**:
- Scans all answer transcripts for: `um/umm`, `ah/uh/uhm`, `like`, `basically`, `actually`, `you know`
- Rendered as animated horizontal bar chart with HSL color scaling (green → amber → red)

**Vocal Speedometer (SVG)**:
- Calculates average WPM across all answers: `words / (speechDuration / 60000)`
- SVG semicircle gauge with a rotating needle driven by CSS `transform: rotate(Xdeg)`
- Needle angle maps WPM range [0–200+] to [-90°, +90°]

**Fluency Grade Calculation**:
```
base = 100
deduct if wpm < 90: (90 - wpm) × 0.7
deduct if wpm > 170: (wpm - 170) × 0.5
deduct for fillers: fillerConcentration × 60 (capped at 35)
grade: A+ (≥90), A (≥82), B+ (≥74), B (≥64), C (≥50)
```

**Articulation & Pause Density**:
- Pause density: `gapsHistory.length / totalQuestions`
- Articulation rating: inverse-normalized confidence average

### Bottom: Detailed Analysis Report

- **Strengths**: Dynamically generated from questions where `correctness >= 75 && accuracy >= 70`
- **Weaknesses**: From questions where `correctness < 65` or `tag === "Bluffing/Incomplete"`
- **Recommended Revisions**: List of subtopic names that need review
- **Weak Concepts** (keyword-matched from answers): entropy, carnot, clausius, AVL, hash, Sommerfeld, Goodman, etc.
- **Question Cards**: Full Q&A replay with difficulty badges and evaluation tags

### Download Report (Print)
- The `no-print` CSS class hides interactive UI buttons during printing
- The `screen-hidden` class renders both the Timeline and Fluency panels stacked vertically in print view
- Students can print-to-PDF for a complete exam report

### Mobile Layout & Grid Responsiveness
To make the post-viva report fully responsive on mobile devices:
- Inline grid and flex stylings were refactored into CSS classes inside `globals.css`:
  - **`.results-grid`**: Replaces the fixed desktop 2-column layout with a single-column layout on screens smaller than `640px`.
  - **`.scorecard-radial-row`**: Adjusts the score radial circle and summary to display centered and vertically stacked on mobile.
  - **`.scorecard-details-grid`**: Flexes from a 2-column details display to a neat single-column stack on touch devices.
  - **`.suggested-revision-row`** & **`.lexical-stats-grid`**: Restructures details text layout constraints so text labels and counts wrap without overflowing container boundaries.

---

## 13. Feature 7 — Interactive Syllabus Mind Map & Target Drills

**File**: `src/components/SetupFlow.jsx` — Step 3

### Mind Map Layout Engine (`getMindMapNodes()`)

Computes a Left-to-Right hierarchical SVG node layout dynamically from `syllabusStructure`:

```
[Subject Root]  →  [Unit 1]  →  [Subtopic 1a]
                             →  [Subtopic 1b]
                             →  [Subtopic 1c]
                →  [Unit 2]  →  [Subtopic 2a]
                             ...
                →  [Unit 3]  →  [Subtopic 3a]
                             ...
```

- **SVG viewport**: 640×340
- **Coordinate system**: Root at (70, 170); Units at (220, spread evenly); Subtopics at (430, evenly distributed under unit)
- **Links**: Cubic Bezier paths `M x1 y1 C midX y1, midX y2, x2 y2`

### Responsive SVG Scaling
- Rather than using static pixel constraints that would cause clipping on small viewports, the mind map SVG element has its width set to `100%`, max-width bounded to `640px`, and max-height set dynamically based on the height of the units/subtopics node tree.
- This configuration enables the mind map to shrink and scale down dynamically to match any client viewport width, preventing layout breakages.

### Node Types & Styles

| Type | Width | Height | Style |
|---|---|---|---|
| subject | 135px | 54px | Navy background, white text, bold |
| unit | 140px | 46px | White with navy border, Unit# + truncated name |
| subtopic | 150px | 32px | White/amber (selected) border, cursor pointer |

### Interaction

- **Hover**: Connector lines light up gold, CSS hover scale 1.035×
- **Click subtopic**: Sets `selectedSubtopic = { unitIndex, topicIndex, name }`
- **Click again**: Deselects (toggle)

### Target Drill Engagement

When a subtopic is selected:
- The Focus Drill info panel shows below the canvas
- Begin button changes to gradient gold: `Begin Target Drill: [subtopic name]`
- Stats preview shows `Duration: 5 Mins (Speed)`, `Scope: 1 Concept`

### Passing Drill Config to ActiveViva

`handleStartExam()` in SetupFlow builds the viva config with:
```js
{
  ...baseConfig,
  isTargetDrill: true,
  targetSubtopic: selectedSubtopic.name
}
```

### AI Question Targeting

In `route.js`, `handleGenerateQuestion()` injects a mandatory instruction block when `isTargetDrill && targetSubtopic`:

```
TARGET DRILL ENFORCED FOCUS:
- This is a highly focused Custom Target Drill centering strictly on: "[targetSubtopic]"
- Formulate ALL questions strictly around concept, equations, physical trade-offs,
  boundaries, or real-world failures of "[targetSubtopic]"
- DO NOT ask questions about other unrelated topics
```

For **offline mode**, `activeSubtopic` is overridden to `targetSubtopic`, so all question templates focus on the chosen concept.

### Active Viva UI for Drills

- Header shows gold badge: `Focus Drill: [Subtopic Name]`
- Examiner greeting morphs: *"Welcome to your dynamic target drill on [subtopic]. Let's begin."*

---

## 14. The API Route — /api/viva

**File**: `src/app/api/viva/route.js`

Single `POST` endpoint handling 5 action types:

### Action 1: `expand-topic`

**Purpose**: Expand a bare topic string (e.g. "Thermodynamics") into a 3-unit structured syllabus.

**Prompt**: Instructs Gemini to produce exactly 3 units, each with 3-4 concise subtopics.

**Response**: `{ topic: string, units: [{ name, topics[] }] }`

### Action 2: `parse-syllabus`

**Purpose**: Parse raw uploaded syllabus text into structured units.

**Input**: `text` (first 6000 chars of extracted document)

**Prompt**: Instructs Gemini to find 3 logical units from the raw text, respecting the document's scope.

**Response**: Same structure as `expand-topic`.

### Action 3: `generate-question`

**Purpose**: Generate the next adaptive exam question with examiner-in-character speech.

**Inputs**:
- `syllabus`: Full structured tree
- `personality`: `friendly | strict | brutal | terror`
- `duration`: Minutes
- `asked`: Array of question texts already asked
- `history`: Array of student answers
- `lastTag`: Last evaluation tag (Strong/Weak/Bluffing/etc.)
- `activeTopic`: Last question's subtopic
- `nervousness`: 0–100 live nervousness score
- `isTargetDrill`, `targetSubtopic`: For drill mode

**Prompt engineering**:
- Injects persona prompt (personality-specific instructions)
- Injects `targetDrillPrompt` if applicable
- Anti-hallucination guards: stay in syllabus, no fictional formulas, connect to last answer
- Human conversation guidelines: fillers, pacing, emotional sensitivity
- `responseMimeType: "application/json"` enforces JSON output

**Response**: `{ text, speech, topic, difficulty }`

### Action 4: `evaluate-answer`

**Purpose**: Grade a student's oral answer against the question and syllabus.

**Output metrics**: `{ correctness, completeness, accuracy, clarity, tag }` (all 0–100)

**Tags**: `Strong | Weak | Partially Correct | Bluffing | Incomplete | Confused`

### Action 4b: `analyze-hume-emotion`

> **Note: This is a local stub, not a real Hume AI call.**

The original intent was to use Hume AI's Expression Measurement API to analyse vocal prosody from the recorded audio blob. However, Hume's REST API is strictly **batch/job-queue based** (asynchronous) and not suitable for real-time mid-viva use without halting the flow.

The current implementation instead runs a **local acoustic estimator**:
1. Estimates recording duration from base64 audio blob size: `length × 0.75 / 16000` bytes → seconds
2. Computes baseline nervousness/confidence/clarity/hesitation from duration heuristics
3. Adds ±4% random jitter to simulate realistic biometric variance
4. Returns these numbers — **no network request to Hume is made**

Real prosody data is already well-covered by two other systems:
- **`AnswerEvaluationService.calculateLocalDeliveryMetrics()`** — lexical analysis of filler words, WPM, pause counts from transcript text
- **Background biometric tracker in `ActiveViva.jsx`** — 350ms polling of `SpeechManager.gapsHistory` and real-time filler detection (not shown on UI to avoid candidate anxiety, but calculated for results page)

---

### Action 5: `synthesize-speech`

**Purpose**: Generate audio from ElevenLabs for the examiner's speech.

**Returns**: Raw `audio/mpeg` binary stream — proxied to avoid CORS and key exposure.

### Gemini Model Waterfall

The `callGeminiAPI()` function tries models in order until one succeeds (6s timeout per model):

```
gemini-2.5-flash-lite  →  gemini-2.5-flash  →  gemini-3.5-flash  →  gemini-3.1-flash-lite
```

JSON output is cleaned of any stray markdown fences before parsing.

---

## 15. Services Reference

### AnswerEvaluationService

| Method | Description |
|---|---|
| `evaluateResponse(params)` | Main entry point: calls Gemini + local delivery metrics, merges results |
| `calculateLocalDeliveryMetrics(text, durationMs, pauseCount)` | Computes filler count, WPM, nervousness, hesitation, confidence locally |
| `getLocalFallbackMetrics(delivery, answerText)` | Returns plausible metrics when API is unavailable |

**Hybrid metric merge**:
- `finalConfidence = localConfidence ± confAdjustment` (Strong=+10, Weak=-15, Bluffing=-20)
- `finalClarity = (localClarity × 0.4) + (geminiClarity × 0.6)`

---

### PDFExtractionService

| Method | Description |
|---|---|
| `loadPDFJS()` | Lazy CDN injection of pdf.js 3.4.120, returns Promise of window.pdfjsLib |
| `extractText(file)` | TXT/MD: FileReader; PDF: pdf.js page-by-page text extraction |

---

### QuestionGraphEngine

| Method | Description |
|---|---|
| `generateNextQuestion(params)` | POST to /api/viva, falls back to getRuleBasedOfflineFallback on error |
| `getRuleBasedOfflineFallback(qIndex, personality, topic)` | Returns hardcoded Thermodynamics questions for qIndex 1–4 |

---

### SessionContextManager

Singleton in-memory store (module-level object, not React state):

| Property | Type | Content |
|---|---|---|
| `askedQuestions` | string[] | Question texts (plain) |
| `askedQuestionsObjects` | object[] | Full question node { text, speech, topic, difficulty } |
| `answerTranscripts` | string[] | Student answer texts |
| `detectedEmotions` | object[] | Per-question metric objects |
| `weakConcepts` | string[] | Keyword-matched technical terms from weak answers |
| `confidenceEvolution` | number[] | Confidence scores per question |
| `askedTopics` | object[] | { topic, metrics } for dynamic strengths/weakness analysis |

| Method | Description |
|---|---|
| `reset()` | Clears all arrays before a new exam |
| `recordRound(params)` | Appends all data for one Q&A round |
| `extractTechnicalTerms(text)` | Keyword matching against domain vocabulary list |
| `compileFinalReport(subject)` | Returns a clean copy of all arrays for onFinishViva |

---

### SyllabusParserService

| Method | Description |
|---|---|
| `cleanRawText(text)` | Normalizes line endings, collapses whitespace |
| `parseSyllabus(rawText, fallbackTopic)` | Regex heuristic extraction of Unit/Module/Chapter/Section patterns |
| `expandTopicTree(topicString)` | POST to /api/viva → "expand-topic" |
| `parseSyllabusRemote(rawText)` | POST to /api/viva → "parse-syllabus" |
| `getDefaultHierarchy(topic)` | Returns hardcoded structures for Data Structures / Machine Design / Thermodynamics |

---

### SpeechManager

| Method | Description |
|---|---|
| `init()` | Creates SpeechRecognition instance with all event listeners |
| `start(callbacks)` | Starts recognition + getUserMedia stream + WebAudio analyser + MediaRecorder |
| `stop()` | Clears timers, stops recognition, stops MediaRecorder, closes AudioContext |
| `resetSilenceTimer()` | Restarts 7.5s countdown |
| `clearSilenceTimer()` | Cancels countdown |
| `isSupported()` | Checks browser support |

---

### VoiceManager

| Method | Description |
|---|---|
| `init()` | Loads browser fallback voices |
| `preload(text, personality)` | Fetches ElevenLabs audio, stores as ObjectURL in cache |
| `speak(text, personality, onStart, onEnd)` | Plays audio (cached or fetched live); falls back to Web Speech |
| `stop()` | Cancels audio playback and Web Speech, invalidates speak ID |
| `pause()` / `resume()` | Delegates to Audio.pause/play or speechSynthesis.pause/resume |
| `isSpeaking()` | Checks !audio.paused or speechSynthesis.speaking |
| `triggerFailsafeFallback(...)` | Browser TTS with personality pacing + forced completion timeout |

### HindsightEngine

| Method | Description |
|---|---|
| `analyze(params)` | Sends full session data to `/api/viva` with `action: "hindsight-analyze"`. Returns cross-question retrospective analysis. Params: `{ subjectName, askedQuestions, askedQuestionsObjects, answerTranscripts, detectedEmotions, personality, mode }` |
| `getLocalFallback(askedQuestions, answerTranscripts, detectedEmotions, mode)` | Rule-based heuristic fallback when API is unavailable. Detects trajectory patterns, contradictions, bluffing via statistical analysis of per-round metrics |

**Return schema:**

| Field | Type | Description |
|---|---|---|
| `sessionNarrative` | string | 2-3 sentence narrative of the student's performance arc |
| `trajectoryPattern` | `"ascending"` \| `"declining"` \| `"steady"` | Direction of confidence over the session |
| `trajectoryDescription` | string | Explanation of the trajectory pattern |
| `contradictions` | array | Objects with `{ rounds: [1,3], description }` for detected answer contradictions |
| `bluffingWarning` | string \| null | Warning if persistent bluffing pattern detected across 2+ rounds |
| `strongestRound` | object | `{ round, topic, score, evidence }` for the best-performing round |
| `weakestRound` | object | `{ round, topic, score, evidence }` for the worst-performing round |
| `recommendations` | string[] | Actionable improvement/revision tips (Gemini only) |
| `adjustedScores` | null | Reserved for future score adjustment feature |
| `isLocalFallback` | boolean | `true` if results came from local heuristics rather than Gemini |

---

## 16. Components Reference

| Component | Lines | Primary Responsibility |
|---|---|---|
| ActiveViva.jsx | 1075 | Core exam engine, state machine, timer, STT/TTS orchestration |
| AuthScreen.jsx | ~450 | Login/signup forms, Google OAuth button, guest bypass |
| Dashboard.jsx | 240 | Home screen: greeting, stats grid, session list, paused session banner |
| ExaminerAvatar.jsx | 497 | SVG portrait engine with dynamic mood animations |
| Header.jsx | ~50 | Logo, user profile chip, navigation callbacks |
| Results.jsx | 1042 | Scorecard, emotion timeline, speech diagnostics, print layout |
| SetupFlow.jsx | 990 | 3-step wizard: syllabus ingestion, config, mind map preview |

---

## 17. Data Models

### Viva Config Object

```ts
{
  topic: string,
  syllabusStructure: {
    topic: string,
    units: Array<{ name: string, topics: string[] }>
  },
  personality: "friendly" | "strict" | "brutal" | "terror",
  duration: number,           // Minutes
  isLastMinute: boolean,      // 5-min cram mode
  isMockExternal: boolean,    // Aggressive board review mode
  isTargetDrill: boolean,     // Focused subtopic mode
  targetSubtopic: string | null,
  isResume: boolean,          // True if restoring paused session
  resumeState: object | null  // Paused session snapshot
}
```

### Question Node Object

```ts
{
  text: string,        // Question text only (displayed in UI)
  speech: string,      // Full spoken text (remark + question, for TTS)
  topic: string,       // The subtopic being tested
  difficulty: "Low" | "Medium" | "High"
}
```

### Per-Round Metrics Object

```ts
{
  confidence: number,    // 30–98
  clarity: number,       // 20–98
  nervousness: number,   // 10–90
  hesitation: number,    // 8–92
  wpm: number,           // Words per minute
  fillerCount: number,
  correctness: number,   // From Gemini: 0–100
  accuracy: number,      // From Gemini: 0–100
  completeness: number,  // From Gemini: 0–100
  tag: "Strong" | "Weak" | "Partially Correct" | "Bluffing" | "Incomplete" | "Confused"
}
```

### Session Record (Firestore / localStorage)

```ts
{
  id: string,           // "session_[timestamp]"
  subject: string,
  duration: number,
  personality: string,  // Human-readable name
  score: number,        // Final calculated score 40–99
  date: string,         // "May 24, 2026"
  gradeClass: "high" | "med" | "low",
  reportData: object,   // Full compiled report (all questions/answers/metrics)
  createdAt: string     // ISO timestamp (Firestore only)
}
```

---

## 18. Firebase Database Schema

```
Firestore:
└── users/
    └── {uid}/
        ├── (document)          → { uid, name, email, createdAt }
        ├── stats/
        │   └── dashboard/      → { totalVivas, avgConfidence, strongestSubject, weakestSubject }
        └── vivas/
            └── {autoId}/       → Session Record (see above)
```

**Key behaviors**:
- Sessions are fetched with `orderBy("createdAt", "desc")` for chronological display
- Stats are reconciled on every login by recomputing from live session data
- Guest migration uploads sessions as a Firestore `writeBatch` for atomic consistency

---

## 19. Offline Fallback Architecture

VivaSim is designed to be **fully functional without any API keys**:

| Feature | Online Behavior | Offline Behavior |
|---|---|---|
| Topic expansion | Gemini generates 3×4 structured tree | Pre-seeded mock for Marketing Management, Computer Networks; regex-based generic generator for others |
| Syllabus parsing | Gemini semantic extraction | Client-side regex heuristic on Unit/Module keywords |
| Question generation | Gemini adaptive branching | Rule-based: rotates 4 hardcoded Thermodynamics questions; if Target Drill, overrides topic to targetSubtopic |
| Answer evaluation | Gemini semantic scoring | Keyword matching + word count heuristics; local delivery metrics |
| TTS voice | ElevenLabs neural audio | Browser SpeechSynthesisUtterance with rate/pitch per personality |
| Authentication | Firebase Auth | Guest mode with localStorage persistence |
| Data storage | Firestore cloud | localStorage with vivasim_* keys |

---

## 20. Score Calculation Algorithms

### Final Session Score

```js
// Average metrics across all 4 questions
confidenceAvg  = avg(detectedEmotions[*].confidence)
clarityAvg     = avg(detectedEmotions[*].clarity)
hesitationAvg  = avg(detectedEmotions[*].hesitation)
nervousnessAvg = avg(detectedEmotions[*].nervousness)

score = (confidenceAvg × 0.4) + (clarityAvg × 0.6)
        - (hesitationAvg × 0.1) - (nervousnessAvg × 0.1) + 12

score = clamp(score, 40, 99)
if endedEarly: score = round(score × 0.6)
```

### Grade Classification

| Score | gradeClass | Dashboard Badge |
|---|---|---|
| >= 80 | high | Green |
| >= 65 | med | Amber |
| < 65 | low | Red |

### Fluency Grade

```js
base = 100
base -= max((90 - wpm) × 0.7, 0)    // Penalty for too slow
base -= max((wpm - 170) × 0.5, 0)   // Penalty for too fast
base -= min(fillerConcentration × 60, 35)  // Filler word penalty

// Grade: A+ (>=90), A (>=82), B+ (>=74), B (>=64), C (>=50)
```

---

## 21. Examiner Personalities

Defined in `src/utils/mockData.js`:

| Key | Name | Patience | Strictness | Stress |
|---|---|---|---|---|
| friendly | Friendly Professor | High | Mild | Low |
| strict | Strict Professor | Moderate | High | Moderate |
| brutal | Brutal External Examiner | Low | Extreme | High |
| terror | Viva Terror | Zero | Unforgiving | Maximum |

### Personality Effects

| Aspect | Friendly | Strict | Brutal | Terror |
|---|---|---|---|---|
| **Prompt tone** | Warm, supportive, hints | Formal, precise, no hints | Skeptical, challenging | Rapid-fire, logic traps |
| **Nervousness handling** | Reduces difficulty | Slightly reduces intensity | Increases pressure | Completely unpredictable |
| **Interruption** | Does not interrupt | Interrupts | Interrupts aggressively | Harsh rebuke |
| **ElevenLabs stability** | 0.65 | 0.65 | 0.38 | 0.22 (dynamic, intense) |
| **ElevenLabs style** | 0.00 | 0.00 | 0.10 | 0.25 (exaggerated emotion) |
| **Web Speech rate** | 0.98 | 0.90 | 1.05 | 0.88 |
| **Web Speech pitch** | 1.05 | 0.90 | 0.95 | 0.80 |

---

## 22. Design System & CSS Architecture

**File**: `src/app/globals.css`

### Color Tokens

```css
--bg-primary:       hsl(40, 10%, 98%)   /* Warm ivory */
--bg-card:          hsl(0, 0%, 100%)    /* White */
--text-primary:     hsl(220, 12%, 15%)  /* Dark charcoal */
--text-secondary:   hsl(220, 6%, 45%)   /* Muted grey */
--accent-primary:   hsl(215, 32%, 18%)  /* Deep navy */
--color-success:    hsl(142, 60%, 30%)  /* Forest green */
--color-warning:    hsl(38, 85%, 35%)   /* Harvest gold */
--color-error:      hsl(0, 60%, 42%)    /* Cardinal red */
--border-color:     hsl(40, 6%, 88%)    /* Hairline borders */
```

### Typography

- **Headers**: `Plus Jakarta Sans` — 700–800 weight
- **Body**: `Inter` — 400–600 weight
- **Serif accent**: `Lora` (italic) for quote-style text

### Key Animation Keyframes

| Keyframe | Effect |
|---|---|
| goldPulse | Pulsing gold shadow on selected mind map nodes |
| marchingAnts | Animated dashed SVG connector paths |
| barShine | Sliding shine overlay on progress bars |
| loadingBar | Sliding auth skeleton loader |
| fadeIn | Screen transition fade |
| slideIn | Toast/banner slide-in |

### Mobile Grid Layout System
- **Static Box Grid Overrides**: On screens narrower than `640px`, the horizontal swipeable carousels for the evaluation panels (Section 3) and methodology pipeline steps (Section 4) are replaced by a static box grid (2x2 layout, with the last item spanning full width if odd).
- **Hiding Decorative Layouts**: The timeline spectrum bar and pipeline connection lines are hidden on mobile layouts, keeping the visual hierarchy simple and legible.

### Notable Component Classes

| Class | Description |
|---|---|
| .mindmap-interactive-subtopic | Subtopic nodes: hover scale, GPU-accelerated |
| .examiner-avatar | SVG portrait base with mood CSS class hooks |
| .mood-pleased.mood-nod | Approval nod animation trigger |
| .mood-stern.mood-shake | Stern headshake animation trigger |
| .waveform-bar | Individual audio visualizer bars |
| .filler-bar-fill | Animated lexical filler gauge fill |
| .info-btn-mobile | Button on examiner card to toggle details overlay on mobile |
| .personality-details-overlay| Mobile overlay details for examiner cards on tap |
| .results-grid | Flexbox/grid wrapper for results cards allowing stacking on mobile |
| .scorecard-radial-row | Custom flex layout for radial score circle to stack on mobile |
| .scorecard-details-grid | Flex layout for academic scorecard fields |
| .suggested-revision-row | Suggested revision container with custom mobile text wrapping |
| .lexical-stats-grid | Word metric summary details adjusted for mobile screens |
| .landing-header | Landing page responsive sticky header |
| .landing-back-link | CTA link for returning to landing page from login |
| .auth-nav-toggle | Responsive switch for auth sign in / sign up tabs |
| .no-print | Hidden during print/PDF export |
| .screen-hidden | Visible only in print mode |

---

## 23. Hindsight Retrospective Analysis

### What Is Hindsight?

Hindsight is a **post-session retrospective analysis pattern** where the AI looks backward at the entire completed exam session to identify cross-question patterns that per-round scoring cannot detect. Unlike real-time evaluation (which scores each answer in isolation as it happens), Hindsight processes all questions and answers **together** after the exam ends, enabling:

- **Contradiction detection**: Finding cases where the student's answer in Round 1 contradicts what they said in Round 3
- **Bluffing pattern detection**: Identifying persistent high verbal confidence paired with low conceptual accuracy across multiple rounds
- **Performance arc narrative**: Understanding whether the student started strong and collapsed, warmed up gradually, or maintained steady composure
- **Evidence-based strongest/weakest identification**: Pinpointing exactly which round was best and worst with detailed reasoning

### Why Hindsight Over Cascade Flow?

VivaSim's existing architecture is already a **cascade flow** — the state machine in `ActiveViva.jsx` chains:

```
generate-question → speak → listen → evaluate-answer → generate-next-question
```

Each stage passes accumulated context downstream. Adding more cascade stages would increase latency between questions and require refactoring the state machine. Hindsight was chosen because:

| Factor | Cascade Flow | Hindsight |
|---|---|---|
| Latency impact on live exam | 🔴 Adds wait between questions | 🟢 Zero (post-exam only) |
| Disrupts existing flow? | 🔴 Yes (new stages in state machine) | 🟢 No (additive layer after `handleFinish`) |
| Implementation risk | 🔴 High (refactor core loop) | 🟢 Low (1 new service, 1 API action, 2 minor edits) |
| Offline graceful degradation | 🔴 Complex (each stage needs fallback) | 🟢 Simple (skip hindsight, use original data) |
| Cross-question pattern detection | ❌ Not possible (each stage sees partial data) | ✅ Sees ALL rounds simultaneously |

### Architecture

Hindsight operates as a purely additive layer that runs between `handleFinish()` and the Results screen:

```
Exam ends → handleFinish() → compileFinalReport()
                                    ↓
                        HindsightEngine.analyze()
                        (async, non-blocking)
                                    ↓
                        Results screen loads immediately
                        with original per-round data
                                    ↓
                        When hindsight resolves → UI updates
                        with retrospective insights
```

**Key design decisions:**

1. **Non-blocking**: The Results screen renders immediately with original data. Hindsight enriches it asynchronously when ready.
2. **Graceful degradation**: If the Gemini API fails, `HindsightEngine.getLocalFallback()` provides heuristic-based analysis using the existing per-round metrics.
3. **Never overwrites**: Hindsight data is stored alongside original scores, never replacing them.
4. **Single API call**: Only one Gemini request per session (vs 8+ during the live exam), minimal quota impact.

### Files Involved

| File | Role |
|---|---|
| `src/services/HindsightEngine.js` | Client-side service that calls the API and provides local fallback |
| `src/app/api/viva/route.js` | Server-side `handleHindsightAnalyze()` function and offline fallback |
| `src/components/ActiveViva.jsx` | Fires `HindsightEngine.analyze()` asynchronously in `handleFinish()` |
| `src/components/Results.jsx` | Renders the "AI Session Retrospective" card with all hindsight insights |
| `src/app/globals.css` | Spinner animation and responsive styles for the retrospective card |

### API Action: `hindsight-analyze`

Added to the existing `/api/viva` route as a new switch case.

**Request payload:**

```json
{
  "action": "hindsight-analyze",
  "subjectName": "Thermodynamics",
  "askedQuestions": ["Q1 text", "Q2 text", ...],
  "askedQuestionsObjects": [{ "text": "...", "topic": "...", "difficulty": "..." }, ...],
  "answerTranscripts": ["A1 text", "A2 text", ...],
  "detectedEmotions": [{ "correctness": 85, "confidence": 78, ... }, ...],
  "personality": "strict",
  "mode": "academic"
}
```

**Response schema:** See [HindsightEngine service reference](#hindsightengine) above.

### Local Fallback Logic

When the API is unavailable, `HindsightEngine.getLocalFallback()` performs heuristic analysis:

1. **Trajectory detection**: Compares average confidence of first-half vs second-half rounds. A difference > 12 points triggers "ascending" or "declining" classification.
2. **Contradiction detection**: Finds round pairs where one scored ≥ 80% correctness and another scored < 55%, flagging potential knowledge inconsistency.
3. **Bluffing detection**: Identifies rounds where confidence > 70% but correctness < 55%. Two or more such rounds trigger a bluffing warning.
4. **Strongest/weakest identification**: Simply finds the round with max and min correctness scores.

### UI: AI Session Retrospective Card

Rendered in the Results screen's left panel (inside the "Plan" mobile tab). Contains:

- **Performance Arc**: Purple-bordered narrative summary of the session trajectory
- **Confidence Trajectory**: Icon + description showing ascending/declining/steady pattern
- **Contradictions**: Red-bordered alerts for cross-question inconsistencies
- **Bluffing Warning**: Amber-bordered alert for detected bluffing patterns
- **Strongest/Weakest Evidence**: Side-by-side green/red cards with round-specific evidence
- **AI Recommendations**: Numbered actionable improvement tips (Gemini-powered only)
- **Loading spinner**: Shown while hindsight is processing
- **Unavailable state**: Graceful message if < 2 rounds completed

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server (with Turbopack)
npm run dev
# → http://localhost:3000

# Production build check
npm run build
```

**Dev server** runs on port 3000 with hot module replacement via Turbopack.

---

*© 2026 VivaSim. Built to make oral exam preparation rigorous, personalized, and surprisingly engaging.*
