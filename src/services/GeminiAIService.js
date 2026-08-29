/**
 * Server-Side Gemini AI Service
 * Unified integration using the official Google Gen AI SDK (@google/genai)
 * Handles Gemini Interaction API calls, multimodal payload assembly, 
 * candidate model rotation, and clean JSON parsing.
 */

import { GoogleGenAI } from "@google/genai";

const DEFAULT_CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.0-flash"
];

export const GeminiAIService = {
  /**
   * Auto-detects audio MIME type from base64 magic bytes or provided MIME type.
   */
  _detectMimeType(audioBase64, providedMimeType) {
    if (providedMimeType && providedMimeType !== "audio/webm" && providedMimeType.startsWith("audio/")) {
      return providedMimeType;
    }
    if (!audioBase64) return "audio/webm";
    const header = audioBase64.substring(0, 16);
    if (header.startsWith("T2dnUw")) return "audio/ogg";
    if (header.startsWith("GkXf")) return "audio/webm";
    if (header.startsWith("UklGR")) return "audio/wav";
    if (header.startsWith("SUQz") || header.startsWith("/++")) return "audio/mpeg";
    if (header.includes("ZnR5cA")) return "audio/mp4";
    return providedMimeType || "audio/webm";
  },

  /**
   * Main entry point for interacting with Gemini AI service.
   * 
   * @param {object} params
   * @param {string} params.prompt - Text prompt for Gemini
   * @param {string} [params.apiKey] - Gemini API Key
   * @param {string} [params.audioBase64] - Optional WebM/OGG/WAV audio encoded in base64
   * @param {string} [params.audioMimeType] - Optional MIME type string (e.g. "audio/ogg")
   * @param {string[]} [params.models] - Custom list of model candidates to try
   * @param {number} [params.timeoutMs=25000] - Timeout in milliseconds per attempt
   * @returns {Promise<object>} Parsed JSON response from Gemini
   */
  async callGeminiInteraction({ prompt, apiKey, audioBase64 = null, audioMimeType = null, previousInteractionId = null, models = DEFAULT_CANDIDATE_MODELS, timeoutMs = 25000 }) {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing from environment variables or request parameters.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    let lastError = null;

    for (const model of models) {
      try {
        const responseJson = await this._executeSingleAttempt(ai, model, prompt, audioBase64, audioMimeType, previousInteractionId, timeoutMs);
        return responseJson;
      } catch (err) {
        console.warn(`GeminiAIService: Model attempt failed [${model}]:`, err.message);
        lastError = err;
      }
    }

    throw new Error(`All candidate models failed. Last error: ${lastError ? lastError.message : "Unknown error"}`);
  },

  /**
   * Internal helper to execute a single interaction attempt with timeout and fallback support.
   */
  async _executeSingleAttempt(ai, model, prompt, audioBase64, audioMimeType, previousInteractionId, timeoutMs) {
    let timeoutId;

    const promise = (async () => {
      let rawText = "";
      let interactionId = null;

      const detectedMime = this._detectMimeType(audioBase64, audioMimeType);

      // Assemble structured parts array
      const parts = [{ text: prompt }];
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: detectedMime,
            data: audioBase64
          }
        });
      }

      const contents = [
        {
          role: "user",
          parts: parts
        }
      ];

      // Primary SDK method: ai.models.generateContent
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            responseMimeType: "application/json"
          }
        });
        rawText = response.text || "";
      } catch (genErr) {
        console.warn(`GeminiAIService: models.generateContent error [${model}], attempting interactions API:`, genErr.message);
        if (ai.interactions && typeof ai.interactions.create === "function") {
          const interactionOptions = { model: model, input: prompt };
          if (previousInteractionId) interactionOptions.previous_interaction_id = previousInteractionId;
          const interaction = await ai.interactions.create(interactionOptions);
          rawText = interaction.output_text || (interaction.outputs && interaction.outputs[0] && interaction.outputs[0].text) || "";
          interactionId = interaction.id || interaction.name || null;
        } else {
          throw genErr;
        }
      }

      if (!rawText) {
        throw new Error("Received empty response string from Gemini API.");
      }

      const parsed = this._parseCleanJson(rawText);
      if (interactionId && typeof parsed === "object" && parsed !== null) {
        parsed.interactionId = interactionId;
      }
      return parsed;
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Helper to strip markdown code blocks and parse clean JSON.
   */
  _parseCleanJson(rawText) {
    let cleanText = rawText.trim();

    // Remove markdown code fences if model returned ```json ... ```
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }

    try {
      return JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("GeminiAIService: Failed to parse raw JSON output:", cleanText);
      throw new Error(`JSON Parse Error: ${parseErr.message}`);
    }
  }
};
