/**
 * The only module that talks to Google. Features describe WHAT they need (prompt + schema +
 * budget); this file handles HOW: model fallback, structured output, thinking off, timeouts,
 * audio attachment and token accounting.
 */
import { AI_CONFIG } from "./config";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Circuit breaker: a model that just answered 429 (quota) is skipped for a while, so every
// request does not pay for a doomed first attempt before reaching a working model.
const COOLDOWN_MS = 45_000;
const coolingUntil = new Map(); // model -> timestamp
const isCooling = (model) => (coolingUntil.get(model) || 0) > Date.now();

// Rolling in-memory usage counters (visible via getUsage(), and logged per call).
const usage = {};
function record(feature, model, meta, ms) {
  const u = usage[feature] || (usage[feature] = { calls: 0, inTokens: 0, outTokens: 0 });
  u.calls += 1;
  u.inTokens += meta?.promptTokenCount || 0;
  u.outTokens += meta?.candidatesTokenCount || 0;
  console.info(`[ai] ${feature} ${model} in=${meta?.promptTokenCount ?? "?"} out=${meta?.candidatesTokenCount ?? "?"} ${ms}ms`);
}
export const getUsage = () => JSON.parse(JSON.stringify(usage));

function parseAudio(raw) {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/^data:(audio\/[a-zA-Z0-9\-+]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "audio/webm", data: raw };
}

function parseJson(text) {
  const clean = String(text || "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(clean);
}

async function attempt({ model, feature, parts, schema, apiKey, cfg }) {
  const generationConfig = {
    responseMimeType: "application/json",
    maxOutputTokens: cfg.maxOut,
    temperature: cfg.temp
  };
  if (schema) generationConfig.responseSchema = schema;
  // Gemini 2.5 models "think" by default, which burns hidden tokens and adds seconds of latency.
  if (model.startsWith("gemini-2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const started = Date.now();
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  });
  if (!res.ok) {
    const err = new Error(`${model} responded ${res.status}`);
    err.status = res.status;
    err.body = (await res.text()).slice(0, 300);
    throw err;
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`${model} returned no content`);
  const parsed = parseJson(text);
  record(feature, model, json.usageMetadata, Date.now() - started);
  return parsed;
}

/**
 * @param {object} o
 * @param {string} o.feature   key into AI_CONFIG.features
 * @param {string} o.prompt    compact instruction text
 * @param {object} [o.schema]  Gemini responseSchema (guarantees the JSON shape, so the prompt needn't describe it)
 * @param {string} [o.audio]   optional base64 / data URL recording
 * @param {string} o.apiKey
 */
export async function callGemini({ feature, prompt, schema, audio, apiKey }) {
  const cfg = AI_CONFIG.features[feature];
  if (!cfg) throw new Error(`Unknown AI feature: ${feature}`);

  const parts = [{ text: prompt }];
  const clip = AI_CONFIG.useAudio ? parseAudio(audio) : null;
  if (clip && clip.data.length <= AI_CONFIG.maxAudioBase64Chars) {
    parts.push({ inlineData: { mimeType: clip.mimeType, data: clip.data } });
  }

  let lastError = null;
  // If every model is cooling down, try them all anyway rather than failing outright.
  const available = AI_CONFIG.models.filter((m) => !isCooling(m));
  for (const model of available.length ? available : AI_CONFIG.models) {
    try {
      return await attempt({ model, feature, parts, schema, apiKey, cfg });
    } catch (err) {
      lastError = err;
      if (err.status === 429) coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      // Some models reject responseSchema; retry once with the schema described in words instead.
      if (err.status === 400 && schema) {
        try {
          const fallbackParts = [{ text: `${prompt}\nReturn ONLY JSON matching: ${JSON.stringify(schema)}` }, ...parts.slice(1)];
          return await attempt({ model, feature, parts: fallbackParts, schema: null, apiKey, cfg });
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
      console.warn(`[ai] ${feature} ${model} failed: ${err.message}${err.body ? ` ${err.body}` : ""}`);
    }
  }
  throw lastError || new Error("All AI models failed");
}
