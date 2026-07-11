# PrepSim Mobile Codebase Audit & Review

This audit provides a detailed review of the PrepSim mobile application codebase, analyzed from a Senior Staff Engineer's perspective. It highlights bugs, security concerns, performance issues, architectural flaws, maintainability bottlenecks, and stack best practices.

---

## Bugs

### 1. Infinite Loading Screen on Initial Launch / Missing Firebase Config
* **File Name**: [AuthContext.js](file:///d:/PrepSim%20mobile/src/context/AuthContext.js#L46-L73)
* **What the issue is**: The `loading` state is initialized using `!isFirebaseConfigured`. If Firebase environment variables are missing (which is common in local offline development), `loading` starts as `true`. The auth listener `useEffect` immediately returns early (`if (!isConfigured) return;`), meaning `setLoading(false)` is never called.
* **Why it matters**: The application is permanently blocked on the loading skeleton screen, rendering it completely broken for any developer or user running the app without active Firebase configuration keys.
* **How to fix**: Initialize `loading` to `isFirebaseConfigured` (so it starts as `false` when offline/unconfigured) or run a secondary block to clear the loading state when Firebase is skipped:
  ```javascript
  const [loading, setLoading] = useState(isFirebaseConfigured);
  ```
* **Priority**: Critical

### 2. Mismatched Event Callback Name in Speech/Voice Managers
* **File Name**: [ActiveViva.jsx](file:///d:/PrepSim%20mobile/src/components/ActiveViva.jsx#L97) and [voiceManager.js](file:///d:/PrepSim%20mobile/src/services/voiceManager.js#L16-L17)
* **What the issue is**: In `ActiveViva.jsx`, the component registers a fallback warning callback by assigning `VoiceManager.onFailsActive = (msg) => { ... }`. However, the `VoiceManager` singleton in `voiceManager.js` defines and calls the handler under the name `onFailsafeActive`.
* **Why it matters**: If ElevenLabs TTS fails and the application falls back to standard browser Speech Synthesis, the component is never notified. The `failsafeWarning` banner is never displayed to the user.
* **How to fix**: Rename `onFailsActive` to `onFailsafeActive` in `ActiveViva.jsx`.
* **Priority**: High

### 3. Thermodynamics Questions Hardcoded in Offline Fallback
* **File Name**: [QuestionGraphEngine.js](file:///d:/PrepSim%20mobile/src/services/QuestionGraphEngine.js#L42-L84)
* **What the issue is**: When the Gemini API call fails or the server is offline, the rule-based fallback `getRuleBasedOfflineFallback` ignores the user's selected subject domain (e.g., Data Structures, Backend Engineering) and exclusively returns questions about thermodynamics (Carnot cycle, Clausius inequality).
* **Why it matters**: If a user is practicing Software Engineering or Data Structures and experiences a brief network drop, the app suddenly forces them to solve thermodynamic equations, breaking curriculum consistency.
* **How to fix**: Map custom mock fallback questions per subject in the engine or reference the static schemas inside `mockData.js`.
* **Priority**: High

### 4. Missing Argument in Evaluation Fallback call
* **File Name**: [AnswerEvaluationService.js](file:///d:/PrepSim%20mobile/src/services/AnswerEvaluationService.js#L85)
* **What the issue is**: In the catch block of `evaluateResponse()`, the fallback call is written as `this.getLocalFallbackMetrics(delivery, answer)`. It fails to pass the `isHesitationPenalty` argument.
* **Why it matters**: When the evaluation API fails, the hesitation penalty logic on line 154 of `getLocalFallbackMetrics` receives `undefined` and will never apply the required correctness/accuracy score penalty.
* **How to fix**: Pass the variable through:
  ```javascript
  return this.getLocalFallbackMetrics(delivery, answer, isHesitationPenalty);
  ```
* **Priority**: Medium

---

## Performance

### 1. Unrevoked Audio ObjectURLs / Memory Leak
* **File Name**: [voiceManager.js](file:///d:/PrepSim%20mobile/src/services/voiceManager.js#L112-L173)
* **What the issue is**: Audios preloaded from ElevenLabs are converted to Object URLs (`URL.createObjectURL(blob)`) and cached in `preloadedCache`. They are never cleaned up or revoked.
* **Why it matters**: In long oral exam sessions with dozens of spoken questions, browser memory accumulates rapidly. On memory-constrained mobile browsers, this will lead to performance degradation or tab crashes.
* **How to fix**: Implement a maximum size for `preloadedCache` and systematically call `URL.revokeObjectURL(url)` on discarded elements.
* **Priority**: Medium

### 2. Unthrottled scroll Event listener
* **File Name**: [AuthScreen.jsx](file:///d:/PrepSim%20mobile/src/components/AuthScreen.jsx#L109-L149)
* **What the issue is**: The scroll event listener recalculates DOM scroll levels and updates style offsets continuously on every scroll tick.
* **Why it matters**: Can lead to layout thrashing and lower FPS on low-end mobile devices.
* **How to fix**: Debounce or throttle scroll callbacks, or replace scroll indicators with CSS Scroll-Driven Animations.
* **Priority**: Low

---

## Security

### 1. Microphone Hardware indicator Leak / Privacy Risk
* **File Name**: [speechManager.js](file:///d:/PrepSim%20mobile/src/services/speechManager.js#L287-L324)
* **What the issue is**: In the `stop()` method of `SpeechManager`, the media recorder and audio context nodes are deactivated, but the media stream tracks are not directly stopped. The stream is only stopped in `MediaRecorder.onstop()`. If the recorder is already inactive, the tracks are never stopped.
* **Why it matters**: The browser's red microphone recording indicator remains on even after the exam has been paused or finished, creating a severe user privacy concern.
* **How to fix**: Directly stop all media stream tracks inside the `stop()` method:
  ```javascript
  if (this.mediaStream) {
    this.mediaStream.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
  }
  ```
* **Priority**: High

### 2. Hardcoded Hume AI API Key in API Route
* **File Name**: [route.js](file:///d:/PrepSim%20mobile/src/app/api/viva/route.js#L120)
* **What the issue is**: The API route defines a hardcoded fallback credentials key for Hume AI (`const humeKey = process.env.HUME_API_KEY || "zxaj1G..."`).
* **Why it matters**: Exposing API keys directly in the codebase risks credential leakage and abuse.
* **How to fix**: Remove the string literal fallback and throw a server-side error if `process.env.HUME_API_KEY` is not set.
* **Priority**: High

---

## Architecture

### 1. Duplication of Domain Syllabus Schemas
* **Files**: [route.js](file:///d:/PrepSim%20mobile/src/app/api/viva/route.js#L146), [SyllabusParserService.js](file:///d:/PrepSim%20mobile/src/services/SyllabusParserService.js#L146), and [SyllabusMasteryService.js](file:///d:/PrepSim%20mobile/src/services/SyllabusMasteryService.js#L87)
* **What the issue is**: The default structures (Backend Engineer, Product Manager, Data Scientist, etc.) are duplicated verbatim in three separate files.
* **Why it matters**: Code bloat and maintenance overhead. Modifying a fallback topic requires synchronizing changes across three files, which easily leads to drift.
* **How to fix**: Consolidate fallback syllabus structures into [mockData.js](file:///d:/PrepSim%20mobile/src/utils/mockData.js) and import them where needed.
* **Priority**: Medium

### 2. State-Leaking Module Singletons
* **Files**: `src/services/speechManager.js`, `src/services/voiceManager.js`, `src/services/SessionContextManager.js`
* **What the issue is**: These files export literal stateful object singletons containing global mutable variables (`isActive`, `askedQuestions`, `audioCtx`).
* **Why it matters**: If users open multiple tabs, or components mount/unmount concurrently, the state from one session can leak into another. It also creates unpredictability during hot reloads during development.
* **How to fix**: Refactor services to instantiate state per session or manage active sessions through a unified React Context provider.
* **Priority**: Medium

---

## Code Quality

### 1. PDF.js Global Variable Overwrite Vulnerability
* **File Name**: [PDFExtractionService.js](file:///d:/PrepSim%20mobile/src/services/PDFExtractionService.js#L25-L27)
* **What the issue is**: On CDN load, the service assigns `window.pdfjsLib = window["pdfjs-dist/build/pdf"]`. 
* **Why it matters**: The CDN script exports `window.pdfjsLib` directly. Overwriting it with `window["pdfjs-dist/build/pdf"]` (which is often undefined under standard CDN script configs) sets the global hook to `undefined`, breaking PDF uploads.
* **How to fix**: Safely acquire the library instance:
  ```javascript
  window.pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
  ```
* **Priority**: High

---

## Maintainability

### 1. Component Over-Bloating
* **Files**: `Results.jsx` (109KB, 1869 lines), `SetupFlow.jsx` (92KB, 1794 lines), and `ActiveViva.jsx` (67KB, 1556 lines).
* **What the issue is**: These React components are massive monolithic files that handle layouts, animations, file parsing, business calculations, and database triggers.
* **Why it matters**: Extremely difficult to audit, run unit tests, or adjust styles without risking regressions.
* **How to fix**: Refactor sub-visualizations into smaller functional components (e.g., `MindMapCanvas`, `FlashcardDeck`, `ScoreGauge`) and extract state orchestration into hooks.
* **Priority**: Medium

---

## Readability

### 1. Uncommented Magic Calculations
* **File Name**: [AnswerEvaluationService.js](file:///d:/PrepSim%20mobile/src/services/AnswerEvaluationService.js#L105-L128)
* **What the issue is**: Complex metrics (like nervousness and confidence index) are derived using hardcoded formulas with arbitrary multipliers (e.g., `fillerCount * 8 + pauseCount * 12 + 10`).
* **Why it matters**: Future developers cannot easily adjust or calibrate these values because the mathematical heuristics have no documentation or explanation.
* **How to fix**: Document the scoring heuristics or extract coefficients into a configurable metrics matrix.
* **Priority**: Low

---

## React/Next.js/Node Best Practices

### 1. Safari Browser Crash due to unsupported WebM MimeType
* **File Name**: [speechManager.js](file:///d:/PrepSim%20mobile/src/services/speechManager.js#L253)
* **What the issue is**: The `MediaRecorder` is hardcoded to instantiate with `{ mimeType: "audio/webm" }`.
* **Why it matters**: iOS and macOS Safari browsers do not natively support WebM audio recording. Attempting to run this line on Safari will trigger a fatal JS execution crash, breaking microphone usage entirely on Apple devices.
* **How to fix**: Detect supported MIME types dynamically:
  ```javascript
  const options = MediaRecorder.isTypeSupported("audio/webm") 
    ? { mimeType: "audio/webm" } 
    : { mimeType: "audio/mp4" };
  ```
* **Priority**: High

### 2. Accidental Session Erasure on Page Refresh (beforeunload Hook)
* **File Name**: [page.js](file:///d:/PrepSim%20mobile/src/app/page.js#L200-L214)
* **What the issue is**: The `beforeunload` event handler actively deletes `vivasim_sessions`, `vivasim_stats`, and `vivasim_user` from local storage when a guest user unloads the tab.
* **Why it matters**: If a guest user accidentally reloads their browser page or temporarily navigates away during an exam, their entire session history and progress are permanently erased.
* **How to fix**: Remove this automatic cleaning from the page unload sequence. Let the guest statistics remain in `localStorage` until the user explicitly selects a "Clear Data" or "Sign Out" action.
* **Priority**: High

---

## Over-Engineering Audit (Ponytail Cuts Summary)

Following standard Ponytail Senior principles, we audited the codebase for over-engineering, dead features, and redundant code lines that can be pruned:

* **delete** `ADAPTIVE_VIVAS` in [mockData.js](file:///d:/PrepSim%20mobile/src/utils/mockData.js#L92). Remove the entire unused object literal (approx. 260 lines of complex nested JSON), which is leftover dead code from the old vanilla JS implementation.
* **delete** duplicate static fallback curriculums in [SyllabusMasteryService.js](file:///d:/PrepSim%20mobile/src/services/SyllabusMasteryService.js#L87) and [SyllabusParserService.js](file:///d:/PrepSim%20mobile/src/services/SyllabusParserService.js#L146). Relocate fallback outlines to a single source of truth inside `mockData.js`, pruning over 180 duplicate lines.
* **delete** [HindsightEngine.js](file:///d:/PrepSim%20mobile/src/services/HindsightEngine.js). Post-session retrospective analysis is a speculative over-engineered feature. It duplicates per-round evaluations and calls a secondary Gemini API endpoint, adding 213 lines of service layer and complex polling logic in `Results.jsx` that can be removed.
* **shrink** `SyllabusParserService.cleanRawText` in [SyllabusParserService.js](file:///d:/PrepSim%20mobile/src/services/SyllabusParserService.js#L11). Replace regex replacement cascades with single-line trim operations.

**Net Potential Removals**:
* **Removable Lines**: ~750 lines of redundant code and dead JSON.
* **Removable Dependencies**: `pdf.js` CDN library could be completely replaced by native HTML text inputs if YAGNI principles are applied strictly, eliminating external script injections.
