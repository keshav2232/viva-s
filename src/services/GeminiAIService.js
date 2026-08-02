/**
 * Server-Side Gemini AI Service
 * Unified integration using the official Google Gen AI SDK (@google/genai)
 * Handles Gemini Interaction API calls, multimodal payload assembly, 
 * candidate model rotation, and clean JSON parsing.
 */

import { GoogleGenAI } from "@google/genai";

const DEFAULT_CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
];

export const GeminiAIService = {
  /**
   * Main entry point for interacting with Gemini AI service.
   * 
   * @param {object} params
   * @param {string} params.prompt - Text prompt for Gemini
   * @param {string} [params.apiKey] - Gemini API Key
   * @param {string} [params.audioBase64] - Optional WebM audio encoded in base64
   * @param {string[]} [params.models] - Custom list of model candidates to try
   * @param {number} [params.timeoutMs=25000] - Timeout in milliseconds per attempt
   * @returns {Promise<object>} Parsed JSON response from Gemini
   */
  async callGeminiInteraction({ prompt, apiKey, audioBase64 = null, models = DEFAULT_CANDIDATE_MODELS, timeoutMs = 25000 }) {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing from environment variables or request parameters.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    let lastError = null;

    for (const model of models) {
      try {
        const responseJson = await this._executeSingleAttempt(ai, model, prompt, audioBase64, timeoutMs);
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
  async _executeSingleAttempt(ai, model, prompt, audioBase64, timeoutMs) {
    let timeoutId;

    const promise = (async () => {
      let rawText = "";

      // Assemble contents array for multimodal (audio + prompt) or text
      const contents = [{ text: prompt }];
      if (audioBase64) {
        contents.push({
          inlineData: {
            mimeType: "audio/webm",
            data: audioBase64
          }
        });
      }

      // Try Interaction API via ai.interactions.create if supported, or ai.models.generateContent
      try {
        if (ai.interactions && typeof ai.interactions.create === "function") {
          const interaction = await ai.interactions.create({
            model: model,
            input: audioBase64 ? contents : prompt
          });
          rawText = interaction.output_text || (interaction.outputs && interaction.outputs[0] && interaction.outputs[0].text) || "";
        }
      } catch (interactionErr) {
        console.warn(`GeminiAIService: interactions.create fallback to models.generateContent [${model}]:`, interactionErr.message);
      }

      if (!rawText) {
        // Primary SDK method: ai.models.generateContent
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            responseMimeType: "application/json"
          }
        });
        rawText = response.text || "";
      }

      if (!rawText) {
        throw new Error("Received empty response string from Gemini API.");
      }

      return this._parseCleanJson(rawText);
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
