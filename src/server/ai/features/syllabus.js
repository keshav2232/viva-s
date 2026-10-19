import { callGemini } from "../gemini";
import { cached, hashText } from "../responseCache";
import { AI_CONFIG } from "../config";
import { clip, normalizeSyllabus } from "../context";
import { syllabusSchema } from "../schemas";

export function getTargetUnitsForDuration(duration) {
  const mins = parseInt(duration, 10) || 5;
  if (mins <= 5) return 2;
  if (mins <= 10) return 3;
  if (mins <= 15) return 4;
  return 5;
}

function validate(result, numUnits) {
  const s = normalizeSyllabus(result);
  if (!s.units.length) throw new Error("syllabus: model returned no units");
  return { topic: s.topic, units: s.units.slice(0, numUnits) };
}

const shape = (mode, n) => mode === "professional"
  ? `exactly ${n} competency areas named like "Competency 1: Backend Engineering", each with 3-4 short skills`
  : `exactly ${n} units named like "Unit 1: Process Scheduling", each with 3-4 short subtopics`;

/** Topic keyword -> outline. Cached: the same topic never costs tokens twice. */
export function runExpandTopic(p, apiKey) {
  const n = getTargetUnitsForDuration(p.duration);
  const topic = clip(p.topic, 120);
  const key = `topic:${p.mode}:${n}:${topic.toLowerCase()}`;
  return cached(key, AI_CONFIG.cacheTtlMs.topic, async () => {
    const prompt = `Expand ${p.mode === "professional" ? "the role" : "the subject"} ${JSON.stringify(topic)} into ${shape(p.mode, n)}. Be concise.`;
    return validate(await callGemini({ feature: "topic", prompt, schema: syllabusSchema, apiKey }), n);
  });
}

/** Pasted/uploaded document -> outline. Input is capped at 4000 characters. */
export function runParseSyllabus(p, apiKey) {
  const n = getTargetUnitsForDuration(p.duration);
  const text = p.text.slice(0, 4000);
  const key = `syllabus:${p.mode}:${n}:${hashText(text)}`;
  return cached(key, AI_CONFIG.cacheTtlMs.syllabus, async () => {
    const prompt = `From this ${p.mode === "professional" ? "job description/resume" : "syllabus/notes"} extract a short title and ${shape(p.mode, n)}. ` +
      `Use only content present in the text.\n"""${text}"""`;
    return validate(await callGemini({ feature: "syllabus", prompt, schema: syllabusSchema, apiKey }), n);
  });
}
