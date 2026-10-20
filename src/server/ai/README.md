# AI layer (server)

Everything the app asks an AI to do goes through `POST /api/viva` -> `src/server/ai/`.

```
route.js            thin entry: guard -> registry -> response
guard.js            rate limits (guest vs signed-in), input normalisation
index.js            feature registry; online run, automatic offline fallback
gemini.js           the only Gemini client: model fallback, structured output, thinking off, usage log
config.js           per-feature token + time budgets, model list, AI_USE_AUDIO switch
schemas.js          responseSchema per feature (shape enforced by the API, not described in prompts)
prompts.js          compact persona/rule fragments
context.js          prompt compaction (outline as text, rolling round summaries)
responseCache.js    TTL cache + in-flight de-dup for repeatable requests
followUps.js        follow-up policy: grade tag x professor x chain depth -> follow up, new topic, or end
features/           turn, hint, syllabus, flashcards, hindsight
offline.js          no-AI engine (same shapes as online)
tts.js              ElevenLabs voice with LRU cache
```

## Calls per feature

| action | purpose | Gemini calls |
|---|---|---|
| `start-session` | first question (prefetched during the mic check) | 1 |
| `turn` | grade the answer **and** write the next question | 1 per answered question |
| `generate-hint` / `generate-subquestion` | stuck-candidate nudges | 1, only when triggered |
| `hindsight-analyze` | post-session retrospective | 1 per session |
| `expand-topic` / `parse-syllabus` / `generate-flashcards` | setup | 1, cached (0 on repeat) |
| `synthesize-speech` | voice (not Gemini) | 0, LRU cached |

## Follow-ups

Each `turn` call asks the model for the grade plus up to two candidates: a follow-up on this answer
and a new main question. `followUps.js` picks one in code from the grade tag, the professor and the
chain depth (max follow-ups per main question: friendly 1, strict 2, brutal 2, terror 3). Follow-ups
do not use up the session's main-question count.

Sessions run on time, not on a fixed count: the duration only sets how many main topics are
planned. The browser sends the seconds left with each answer; the session continues (with bonus
questions once the planned topics are covered) until less than max(35 s, 45% of an average
question) remains. Follow-ups get a fair share of the remaining time so every planned topic is still
asked, questions near the end are kept short, and an answer cut off by the clock is still graded. While the student
is stuck, the viva room runs each professor's silence steps (8 s thinking time first) and keeps the
words already spoken as part of the answer.

## Token controls

- Structured output (`responseSchema`) instead of example JSON in the prompt.
- `thinkingBudget: 0` on 2.5 models; hard `maxOutputTokens` per feature.
- Outline sent as short text, only the last 2 rounds carry answer text, answers/questions clipped.
- Grader receives the question's own key points (written once when the question is created) as a rubric.
- No context cache (it was padded filler and the prompt already carried the context).
- Audio is optional: `AI_USE_AUDIO=false` grades text only (about 32 tokens saved per second of speech).
- Each call logs `[ai] <feature> <model> in=<n> out=<n> <ms>`.

## Adding a feature

1. `features/yourFeature.js` exporting `runYourFeature(payload, apiKey)`.
2. A budget in `config.js`, a schema in `schemas.js`.
3. One line in `FEATURES` (`index.js`) and, if it needs a fallback, a branch in `offline.js`.
