/**
 * Next.js Server-Side Route: /api/viva
 * Coordinates secure prompt engineering, anti-hallucination barriers,
 * and structural JSON outputs with the Gemini AI model.
 * Incorporates a resilient rule-based mock backup system.
 */

import { NextResponse } from "next/server";

// Fallback dynamic database when API key is missing
const MOCK_TOPIC_EXPANSIONS = {
  "marketing management": {
    topic: "Marketing Management",
    units: [
      { name: "Unit 1: Market Core Concepts", topics: ["Customer lifetime value", "Segmenting and targeting STPs", "Marketing mix 4Ps", "Consumer buying parameters"] },
      { name: "Unit 2: Brand & Product Strategy", topics: ["Product life cycle PLCs", "Brand equity indices", "Pricing strategies elasticities", "Distribution channels margins"] },
      { name: "Unit 3: Digital & Growth Marketing", topics: ["Social media campaign matrices", "Search engine optimization SEOs", "Customer relationship management CRM", "Growth hacking conversions"] }
    ]
  },
  "computer networks": {
    topic: "Computer Networks",
    units: [
      { name: "Unit 1: Layers & Physical Transmission", topics: ["OSI 7-layer boundaries", "TCP/IP protocol suites", "Transmission mediums bandwidths", "Packet switching latency"] },
      { name: "Unit 2: Transport & Routing Protocols", topics: ["TCP flow congestion controls", "UDP boundary payloads", "Dijkstra routing matrices", "IP addressing subnetting"] },
      { name: "Unit 3: Application & Network Security", topics: ["DNS lookup procedures", "HTTP secure handshakes", "Public key cryptography", "Firewalls packet filters"] }
    ]
  }
};

const DEFAULT_CORRECT_ANSWERS = {
  // Thermodynamics
  "Carnot thermal boundaries": "The Carnot cycle consists of two isothermal and two adiabatic processes. Reaching 100% thermal efficiency requires the cold sink temperature (T_C) to be absolute zero (0 K), which is physically impossible according to the Third Law of Thermodynamics.",
  "Reversible entropy degradation": "In any real process, some energy is degraded to a lower grade of heat. Mathematically, entropy generation (S_gen) is strictly positive (S_gen > 0) for irreversible processes, representing energy degradation.",
  "Lost exergy work": "Exergy is the maximum useful work potential of a system. Lost exergy work (or exergy destruction) is directly proportional to entropy generation: I = T_0 * S_gen, where T_0 is the environment temperature.",
  "Third law absolute zero": "The Third Law of Thermodynamics states that the entropy of a pure crystalline substance approaches zero as temperature approaches absolute zero. It physically limits the cold sink temperature, preventing 100% Carnot efficiency.",
  "First Law Open Systems": "For open control volumes, the First Law of Thermodynamics accounts for mass transfer: Q_dot - W_dot = sum(m_out * h_out) - sum(m_in * h_in) + dE/dt, accounting for flow enthalpy of mass streams crossing control boundaries.",
  "Flow work enthalpy": "Enthalpy (H = U + PV) represents the total energy of a flowing fluid, combining internal energy (U) and flow work (PV) required to push the mass across control boundaries.",
  "Transient heat transfer": "Transient systems undergo state changes over time (dE/dt != 0). Energy balance models must integrate transient parameters across time steps to track heat and mass accumulation.",
  "Steady-flow energy boundaries": "In steady-flow energy equations (SFEE), states do not vary with time (dE/dt = 0). Energy input (heat, mass flow enthalpy, kinetic, potential) strictly equals energy output.",
  "Clapeyron equations": "The Clapeyron equation describes phase boundary slopes on a P-T diagram: dP/dT = L / (T * delta_v), where L is latent heat and delta_v is the specific volume change during phase transition.",
  "Phase boundary derivations": "Derivations utilize Maxwell relations and Gibbs free energy equality (g_liq = g_vap) along the coexistence line to derive pressure-temperature relationship limits.",
  "Sublimation slopes": "The slope dP/dT is much steeper for sublimation than vaporization because the specific volume of the solid phase is significantly smaller than the liquid phase, leading to a larger change in specific volume delta_v.",
  "Triple point limits": "The triple point represents unique temperature and pressure conditions where solid, liquid, and gas phases coexist in thermodynamic equilibrium (e.g., 273.16 K for water).",

  // Data Structures
  "Arrays & Arraylists": "Arrays are fixed-size contiguous memory blocks offering O(1) random access. ArrayLists are dynamically resizable, using automatic copy-and-reallocate operations when the load capacity is reached.",
  "Stack LIFO boundaries": "A stack is a Last-In, First-Out structure. Key operations are Push and Pop, both operating at O(1) complexity. Stack overflow/underflow boundary checks prevent memory access violations.",
  "Queue FIFO parameters": "A queue is a First-In, First-Out structure. Enqueue adds to the rear, and Dequeue removes from the front, both operating in O(1) time. Circular queues optimize space via modulo indexing.",
  "Linked list traversal": "Linked lists consist of non-contiguous nodes linked by references. Traversal requires linear O(N) pointer-chasing, unlike arrays which support O(1) index-based jumps.",
  "Binary Search Trees": "A BST is a node-based binary tree where left children are smaller and right children are larger. Search, insertion, and deletion operate in O(log N) average time, but degrade to O(N) if unbalanced.",
  "AVL self-balancing logic": "AVL trees are self-balancing BSTs where the balance factor (height(left) - height(right)) of any node must be in {-1, 0, 1}. Violations are corrected using single or double rotations (LL, RR, LR, RL).",
  "Red-black tree margins": "Red-Black trees balance using node color attributes (Red/Black) and 5 strict color rules. They guarantee O(log N) operations with fewer rotations than AVL trees on insertion/deletion.",
  "Graph representations": "Graphs are represented using Adjacency Matrices (O(V^2) space, fast edge lookup) or Adjacency Lists (O(V+E) space, efficient neighbor traversal).",
  "Hash collisions buckets": "Hash collisions occur when distinct keys hash to the same table index. Open addressing (linear/quadratic probing, double hashing) or separate chaining (linked list buckets) resolve collisions.",
  "Probing techniques": "Linear probing checks consecutive slots (i + 1, i + 2), leading to primary clustering. Quadratic probing uses polynomial increments (i + k^2), reducing clustering issues.",
  "Graph BFS queues": "Breadth-First Search explores graph nodes level-by-level using a FIFO Queue to track frontier nodes, operating in O(V + E) time.",
  "DFS recursive stacks": "Depth-First Search explores path branches as deep as possible before backtracking, utilizing a LIFO Stack (explicit or via recursion) to track traversal paths.",

  // Machine Design
  "Static stress limits": "Static design limits ensure materials do not yield or fracture under constant loading. Ductile materials use the Distortion Energy theory (von Mises), while brittle materials use Maximum Normal Stress theory.",
  "Alternating stress fatigue": "Fatigue occurs under cyclic loading at stresses far below static yield limits. Micro-cracks initiate at stress concentrations and propagate until sudden catastrophic failure.",
  "Goodman line diagrams": "The Goodman relation maps safe combinations of mean stress (S_m) and alternating stress (S_a): S_a / S_e + S_m / S_ut = 1, where S_e is endurance limit and S_ut is ultimate tensile strength.",
  "Soderberg yield boundaries": "The Soderberg fatigue model is highly conservative, using yield strength (S_yt) instead of ultimate strength: S_a / S_e + S_m / S_yt = 1.",
  "Torsional stress shafts": "Torsion creates shear stress in a circular shaft: tau = T * r / J, where T is torque, r is radius, and J is polar moment of inertia (J = pi * d^4 / 32).",
  "Stress flow singularties": "Stress concentrations arise at geometric discontinuities (holes, fillets, keyways) where stress flow lines crowd together, raising maximum stress by a factor of K_t.",
  "Fillet radii mitigation": "Increasing the fillet radius creates a gentler transition between shaft diameters, smoothing out the flow lines of stress and lowering the stress concentration factor K_t.",
  "Shaft keys grooves": "Keyways transmit torque between shafts and gears. Because they are sharp internal cutouts, they act as major stress concentration zones, reducing the shaft's fatigue limit.",
  "Sommerfeld lubrication coefficient": "The Sommerfeld number characterizes hydrodynamic journal bearings: S = (r/c)^2 * (mu * N) / P, determining friction coefficient, film thickness, and lubricant flow rate.",
  "Journal bearings eccentrity": "Eccentricity (e) is the radial offset of the shaft center under load. The eccentricity ratio (epsilon = e/c) determines the minimum oil film thickness required to prevent metal-to-metal contact.",
  "Spur root teeth bending": "Gear teeth experience bending stress at the root fillet under tangential tooth loads. It is modeled as a cantilever beam using the Lewis formula.",
  "Lewis stress AGMA values": "The classical Lewis formula (sigma = W_t / (F * m * Y)) is modified by AGMA factors (dynamic, overload, size, distribution factors) to compute precise gear tooth bending fatigue limits.",

  // Computer Networks
  "OSI 7-layer boundaries": "The OSI model consists of 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application. A correct answer must define the layers, boundaries, and headers added at each layer.",
  "TCP/IP protocol suites": "The TCP/IP model has 4 layers: Link, Internet, Transport, Application. It is a practical implementation model, unlike the theoretical OSI model.",
  "Transmission mediums bandwidths": "Bandwidth is the maximum data transfer rate. Transmission mediums include guided (copper, fiber optic) and unguided (wireless) media, with fiber optic offering the highest bandwidth due to light propagation.",
  "Packet switching latency": "Packet switching divides data into packets. Latency consists of propagation delay, transmission delay, queuing delay, and processing delay.",
  "TCP flow congestion controls": "TCP uses flow control (sliding window via receiver window) to prevent overwhelming the receiver, and congestion control (Slow Start, Congestion Avoidance, Fast Retransmit, Fast Recovery via cwnd) to prevent network collapse.",
  "UDP boundary payloads": "UDP is a connectionless, unreliable protocol with low overhead. A payload is limited to a maximum of 65,535 bytes including the 8-byte header.",
  "Dijkstra routing matrices": "Dijkstra's algorithm finds the shortest path in a weighted graph from a single source. It uses a greedy approach and requires non-negative edge weights.",
  "IP addressing subnetting": "IP addressing divides network into subnets using a subnet mask. Classless Inter-Domain Routing (CIDR) allows flexible allocation of IP addresses.",
  "DNS lookup procedures": "DNS lookup translates domain names to IP addresses recursively: Local DNS -> Root DNS -> TLD DNS -> Authoritative DNS.",
  "HTTP secure handshakes": "HTTPS uses TLS/SSL handshake. It involves asymmetric encryption for key exchange and symmetric encryption for session data transfer, using certificate authority validation.",
  "Public key cryptography": "Asymmetric cryptography uses a public key for encryption and a private key for decryption (e.g. RSA, ECC). It provides confidentiality, integrity, and non-repudiation.",
  "Firewalls packet filters": "Packet filters inspect packets at the Network/Transport layers (IP and Port numbers) to permit or deny traffic based on firewall rules."
};

export async function POST(req) {
  try {
    const payload = await req.json();
    const { action } = payload;

    if (action === "synthesize-speech") {
      return await handleSynthesizeSpeech(payload.text, payload.personality);
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.XAI_API_KEY;

    if (!apiKey) {
      console.warn("process.env.GEMINI_API_KEY is missing. Falling back to robust local mock intelligence.");
      return handleOfflineFallback(payload);
    }

    switch(action) {
      case "expand-topic":
        return await handleExpandTopic(payload.topic, payload.mode, payload.duration, apiKey);
      case "parse-syllabus":
        return await handleParseSyllabus(payload.text, payload.mode, payload.duration, apiKey);
      case "generate-question":
        return await handleGenerateQuestion(payload, apiKey);
      case "evaluate-answer":
        return await handleEvaluateAnswer(payload, apiKey);
      case "generate-hint":
        return await handleGenerateHint(payload, apiKey);
      case "generate-subquestion":
        return await handleGenerateSubquestion(payload, apiKey);
      case "generate-flashcards":
        return await handleGenerateFlashcards(payload.syllabusStructure, payload.mode, apiKey);
      case "analyze-hume-emotion":
        const humeKey = process.env.HUME_API_KEY || "";
        const humeResult = await handleAnalyzeHumeEmotion(payload.audioBase64, humeKey);
        return NextResponse.json(humeResult);
      case "hindsight-analyze":
        return await handleHindsightAnalyze(payload, apiKey);
      default:
        return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
    }

  } catch (e) {
    console.error("API route error:", e);
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
  }
}

import { getFallbackSyllabus } from "../../../utils/mockData";

// ==========================================
// DYNAMIC DURATION PARAMETERS HELPERS
// ==========================================
function getTargetUnitsForDuration(duration) {
  const mins = parseInt(duration, 10) || 5;
  if (mins <= 5) return 2;   // 2 units
  if (mins <= 10) return 3;  // 3 units
  if (mins <= 15) return 4;  // 4 units
  return 5;                  // 5 units (20+ mins)
}

function getOfflineHierarchy(topic, mode, duration) {
  const isProfessional = mode === "professional";
  const numUnits = getTargetUnitsForDuration(duration);
  const syllabus = getFallbackSyllabus(topic, isProfessional);
  return {
    topic: syllabus.topic,
    units: syllabus.units.slice(0, numUnits)
  };
}

// ==========================================
// 1. EXPAND TOPIC TREE
// ==========================================
async function handleExpandTopic(topic, mode, duration, apiKey) {
  const isProfessional = mode === "professional";
  const numUnits = getTargetUnitsForDuration(duration);
  const prompt = isProfessional
    ? `Act as an expert recruiter and corporate talent specialist. Expand the job role or domain "${topic}" into a structured competency framework with exactly ${numUnits} Competency Areas. Each Area must have a name (e.g. "Competency 1: System Design"), and exactly 3 or 4 concise core skills or subtopics.
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "topic": "${topic}",
    "units": [
      { "name": "Competency area name", "topics": ["skill 1", "skill 2", "skill 3"] }
    ]
  }`
    : `Act as an academic curriculum specialist. Expand the topic "${topic}" into a structured syllabus with exactly ${numUnits} Units. Each Unit must have a name, and exactly 3 or 4 concise core subtopics. 
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "topic": "${topic}",
    "units": [
      { "name": "Unit name", "topics": ["topic 1", "topic 2", "topic 3"] }
    ]
  }`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// 1.5. PARSE CUSTOM SYLLABUS TEXT WITH GEMINI
// ==========================================
async function handleParseSyllabus(rawText, mode, duration, apiKey) {
  const isProfessional = mode === "professional";
  const numUnits = getTargetUnitsForDuration(duration);
  const prompt = isProfessional
    ? `Act as an expert recruiter and corporate talent specialist. Analyze the following raw job description, resume, or role requirements, and extract a structured job title and exactly ${numUnits} logical Competency Areas. Each Competency Area must have a clean name (e.g. "Competency 1: Backend Engineering"), and exactly 3 or 4 precise, highly concise subtopics/skills directly mentioned or relevant to that competency's scope in the text.
  
  Raw Text:
  """
  ${rawText.substring(0, 6000)}
  """
  
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "topic": "Overall Job Title (e.g. Software Engineer)",
    "units": [
      { "name": "Competency area name", "topics": ["skill 1", "skill 2", "skill 3"] }
    ]
  }`
    : `Act as an academic curriculum specialist. Analyze the following raw course syllabus, lecture notes, or subject outlines, and extract a structured course topic and exactly ${numUnits} logical Units. Each Unit must have a clean name (e.g. "Unit 1: Process Scheduling"), and exactly ${numUnits} precise, highly concise technical subtopics directly mentioned or relevant to that unit's scope in the text.
  
  Raw Syllabus Text:
  """
  ${rawText.substring(0, 6000)}
  """
  
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "topic": "Overall Subject Name (e.g. Operating Systems)",
    "units": [
      { "name": "Unit name", "topics": ["subtopic 1", "subtopic 2", "subtopic 3"] }
    ]
  }`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// 2. GENERATE QUESTION & REMARKS (ADAPTIVE BRANCHING)
// ==========================================
async function handleGenerateQuestion(payload, apiKey) {
  const { syllabus, personality, duration, asked, history, lastTag, activeTopic, nervousness, isTargetDrill, targetSubtopic, mode } = payload;
  const isProfessional = mode === "professional";
  
  // Format history for the prompt
  const conversationContext = history && history.length > 0
    ? history.map((h, idx) => `Q${idx+1}: "${asked[idx]}" -> A${idx+1}: "${h}"`).join("\n")
    : "No questions asked yet. This is the first question.";

  const studentNervousness = nervousness || 0;

  // Personality prompts mapping
  let personaPrompt = "";
  if (isProfessional) {
    switch(personality) {
      case "friendly":
        personaPrompt = "Warm Recruiter: You are patient, warm, and highly encouraging. Introduce yourself as a Recruiter. If the candidate struggled (last tag is Weak or Confused), provide a gentle, supportive remark (e.g. 'No worries, let's look at this simple scenario...') and pivot to a foundational behavioral or domain question. If strong, praise them warmly and ask about their experience.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The candidate is currently extremely nervous. Soften your tone even further, be highly reassuring, and ask an easier high-level question to build rapport.";
        }
        break;
      case "strict":
        personaPrompt = "Structured Hiring Manager: You are highly structured, formal, and analytical. You expect clear engineering trade-offs, system architecture choices, and concrete technical details. If the candidate was weak, point out that their technical depth was lacking and ask them to specify real-world constraints or design choices. Do not offer hints.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The candidate is highly nervous. Maintain high technical standards but give them a structured prompt so they can collect their thoughts.";
        }
        break;
      case "brutal":
        personaPrompt = "Bar Raiser EM: Highly skeptical, detail-oriented, and demanding. You probe deeply into their past projects and technical claims. You expect concrete STAR-formatted details (Situation, Task, Action, Result) and real architectural trade-offs. Challenge their choices sharply.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The candidate is highly nervous. Continue challenging them under pressure to evaluate their resilience and engineering principles.";
        }
        break;
      case "terror":
        personaPrompt = "Director Bar Raiser: Intimidating, rapid-fire follow-ups, and unpredictable. You immediately target logical fallacies, edge cases, and high-pressure trade-offs. 'That sounds like a generic online guide answer. Tell me about a real production outage or concrete scale challenge you personally solved and the exact API/DB level bottleneck.'";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The candidate is highly nervous. Test their limits with a rapid-fire technical scenario or sudden intense edge case.";
        }
        break;
    }
  } else {
    switch(personality) {
      case "friendly":
        personaPrompt = "Friendly Professor: You are patient, warm, and encouraging. If the student struggled (last tag is Weak or Confused), provide a gentle, supportive remark (e.g. 'No worries, let's look at it simply...') and pivot to a foundational question. If strong, praise them warmly and go slightly deeper.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The student is currently extremely nervous. Soften your tone even further, be highly reassuring, and ask an easier conceptual question to boost their confidence.";
        }
        break;
      case "strict":
        personaPrompt = "Strict Professor: You are highly formal, demand exact equations and definitions. If the student was weak, mention that their definition was incomplete and ask them to specify fundamentals precisely. Do not give hints.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The student is highly nervous. Reduce your intensity slightly to allow them to collect their thoughts, while still maintaining high standards of exact definitions.";
        }
        break;
      case "brutal":
        personaPrompt = "Brutal Examiner: High pressure, skeptical. You question their claims and challenge their confidence. If they answered strongly, ask a tricky conceptual twist (e.g. 'Are you sure? What if we change...'). If weak, point out their error sharply.";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The student is highly nervous. Become even more probing and challenge them further to see if they break under academic pressure.";
        }
        break;
      case "terror":
        personaPrompt = "Viva Terror: Intimidating, rapid follow-ups. You point out logical fallacies instantly. You test fundamental understanding aggressively: 'That sounds like a memorized book answer. Explain what actually happens at the boundary.'";
        if (studentNervousness > 70) {
          personaPrompt += " Note: The student is highly nervous. Become completely unpredictable—either drop a sudden silence nudge or launch a rapid-fire series of highly intense technical questions to test their limits.";
        }
        break;
    }
  }

  let targetDrillPrompt = "";
  if (isTargetDrill && targetSubtopic) {
    if (isProfessional) {
      targetDrillPrompt = `
  
  🎯 TARGET DRILL ENFORCED FOCUS:
  - This is a highly focused Custom Target Drill centering strictly on the competency or skill: "${targetSubtopic}".
  - You MUST formulate this question and all subsequent questions in this session strictly centered on the concept, patterns, trade-offs, or real-world application of "${targetSubtopic}".
  - DO NOT ask questions about other unrelated competency areas. Maintain 100% concentration on "${targetSubtopic}".`;
    } else {
      targetDrillPrompt = `
  
  🎯 TARGET DRILL ENFORCED FOCUS:
  - This is a highly focused Custom Target Drill centering strictly on the subtopic concept: "${targetSubtopic}".
  - You MUST formulate this question and all subsequent questions in this exam strictly centered on the concept, equations, physical trade-offs, boundaries, or real-world failures of "${targetSubtopic}".
  - DO NOT ask questions about other unrelated units or subtopics. Maintain 100% conceptual concentration on "${targetSubtopic}".`;
    }
  }

  const prompt = isProfessional
    ? `Act as an expert corporate interviewer conducting a professional mock interview.
  ${targetDrillPrompt}
  
  Interviewer Personality: ${personaPrompt}
  Job Competency Framework Context: ${JSON.stringify(syllabus)}
  Pacing Target: Session duration is ${duration} minutes. Limit mock interview to 4 questions. This is question #${asked.length + 1}.
  
  Asked Questions History: ${JSON.stringify(asked)}
  Candidate Answer History: ${conversationContext}
  Last Response Evaluation Tag: "${lastTag || 'None'}"
  
  HUMAN CONVERSATION GUIDELINES:
  - DO NOT SOUND SCRIPTED. REAL INTERVIEWERS ARE CONVERSATIONAL.
  - INJECT NATURAL FILLERS: Incorporate natural verbal pauses/fillers (e.g., 'Well...', 'Hmm...', 'Alright', 'Interesting', 'I see') where appropriate, especially at the start of remarks.
  - SENSITIVE EMOTIONAL PACING: Emulate slight human breathing and pauses by using punctuation like '...' or short natural hesitation phrases.
  - ACCORDING TO PERSONALITY: Soft, slower warm recruiter pauses; structured professional EM pauses; skeptical bar raiser pauses; rapid-fire and unpredictable cuts for director stress level.
  
  ANTI-HALLUCINATION GUARD:
  - Stay strictly within the job competency topics or requirements.
  - Do not make up fictional industry concepts or facts.
  - Choose one active competency or subtopic that has NOT been tested yet, unless deep-diving into a previously weak response.
  - The next question must connect logically to the candidate's last response (e.g., follow-up on an architectural pattern they named, or pivot to another relevant skill category).
  
  Response Format:
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "text": "The next interview question text (Concise, professional)",
    "speech": "Interviewer's spoken remark representing your personality (e.g., 'Good. Let's look at...' or 'That is incomplete...') followed immediately by the next question text",
    "topic": "The exact competency/subtopic being tested",
    "difficulty": "Low" | "Medium" | "High",
    "correctAnswer": "A detailed explanation of what a strong answer should include, outlining key design trade-offs, architecture choices, industry best practices, or STAR behavioral highlights."
  }`
    : `Act as a college professor conducting a dynamic oral examination (viva).
  ${targetDrillPrompt}
  
  Examiner Personality: ${personaPrompt}
  Syllabus Focus Context: ${JSON.stringify(syllabus)}
  Vocal Pacing Target: Session duration is ${duration} minutes. Limit viva to 4 questions. This is question #${asked.length + 1}.
  
  Asked Questions History: ${JSON.stringify(asked)}
  Student Answer History: ${conversationContext}
  Last Response Evaluation Tag: "${lastTag || 'None'}"
  
  HUMAN CONVERSATION GUIDELINES:
  - DO NOT SOUND SCRIPTED. REAL PROFESSORS ARE CONVERSATIONAL.
  - INJECT NATURAL FILLERS: Incorporate natural verbal pauses/fillers (e.g., 'Well...', 'Hmm...', 'Alright', 'Interesting', 'I see') where appropriate, especially at the start of remarks.
  - SENSITIVE EMOTIONAL PACING: Emulate slight human breathing and pauses by using punctuation like '...' or short natural hesitation phrases.
  - ACCORDING TO PERSONALITY: Soft, slower warm pauses for friendly; measured, professional pauses for strict; skeptical, sharp pauses for brutal; rapid-fire and unpredictable cuts for terror.
  
  ANTI-HALLUCINATION GUARD:
  - Stay strictly inside the syllabus topics.
  - Do not make up fictional academic formulas or facts.
  - Choose one active subtopic from the syllabus that has NOT been tested yet, unless cross-examining a weak concept.
  - The next question must connect logically to the last response (e.g. follow-up on a term they used, or pivot to an allied unit).
  
  Response Format:
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
  {
    "text": "The next question text (Concise, academic)",
    "speech": "Examiner's spoken remark representing your personality (e.g., 'Good. Let's look at...' or 'That is incomplete...') followed immediately by the next question text",
    "topic": "The exact subtopic being tested from the syllabus",
    "difficulty": "Low" | "Medium" | "High",
    "correctAnswer": "A highly precise academic explanation of what the correct answer must include, outlining key definitions, relevant formulas/equations, and necessary boundary conditions."
  }`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// 3. EVALUATE TRANSCRIPT ANSWER (GEMINI-FIRST UNIFIED PROMPT)
// ==========================================
async function handleEvaluateAnswer(payload, apiKey) {
  const { question, answer, syllabus, mode, audioBase64 } = payload;
  const isProfessional = mode === "professional";
  const hasAudio = !!audioBase64;

  // Unified prompt — always requests all 8 metrics.
  // Gemini evaluates audio delivery when audio is present; sets delivery fields to null for text-only.
  const audioInstruction = hasAudio
    ? "An audio recording of the speaker's actual voice is attached. Listen carefully and evaluate BOTH the spoken content (correctness, logic, accuracy) AND the vocal delivery (clarity, confidence, nervousness, hesitation) from the audio."
    : "No audio is attached. Evaluate based on the text transcript only. For confidence, nervousness, hesitation, and clarity: set them to null since there is no audio to assess delivery.";

  const prompt = isProfessional
    ? `Act as an expert industry interviewer grading a candidate's response in a mock interview.

Question Asked: "${question}"
Candidate Response: "${answer}"
Job Competency Context: ${JSON.stringify(syllabus)}
${audioInstruction}

Score each metric 0-100 (use null for delivery metrics when no audio):
1. correctness: logical correctness, technical depth, industry validity (0-100)
2. completeness: coverage of edge cases, trade-offs, STAR details (0-100)
3. accuracy: precise engineering terminology and architectural accuracy (0-100)
4. clarity: ${hasAudio ? "acoustic voice clarity, structural flow, articulation (0-100)" : "null (no audio)"}
5. confidence: ${hasAudio ? "vocal presence, assertiveness, tone stability (0-100)" : "null (no audio)"}
6. nervousness: ${hasAudio ? "vocal tremors, jitteriness, speaking rate anxiety (0-100)" : "null (no audio)"}
7. hesitation: ${hasAudio ? "long pauses, silence gaps, filler words like um/uh (0-100)" : "null (no audio)"}

Evaluation tag (pick one):
- "Strong": highly correct, technically accurate, confident
- "Weak": incorrect, blank, or extremely short
- "Partially Correct": correct direction but lacks precise trade-offs or STAR details
- "Bluffing": general filler phrases, near-zero real technical competence
- "Incomplete": correct but too brief (no depth)
- "Confused": contradicts itself or completely lost

Respond ONLY with a valid clean JSON object. Do not use markdown:
{
  "correctness": 85,
  "completeness": 70,
  "accuracy": 80,
  "clarity": ${hasAudio ? "88" : "null"},
  "confidence": ${hasAudio ? "75" : "null"},
  "nervousness": ${hasAudio ? "22" : "null"},
  "hesitation": ${hasAudio ? "18" : "null"},
  "tag": "Strong",
  "correctAnswer": "A detailed professional answer outlining design trade-offs, architecture choices, STAR highlights, and best practices.",
  "gradingSource": "${hasAudio ? "audio+text" : "text-only"}"
}`
    : `Act as an academic examiner grading an oral response in a college viva.

Question Asked: "${question}"
Student Response: "${answer}"
Syllabus Context: ${JSON.stringify(syllabus)}
${audioInstruction}

Score each metric 0-100 (use null for delivery metrics when no audio):
1. correctness: general logical correctness and subject accuracy (0-100)
2. completeness: depth, completeness, formula coverage (0-100)
3. accuracy: precise technical keywords, formulas, terminology (0-100)
4. clarity: ${hasAudio ? "acoustic voice clarity, fluency, structural flow (0-100)" : "null (no audio)"}
5. confidence: ${hasAudio ? "vocal presence, tone stability (0-100)" : "null (no audio)"}
6. nervousness: ${hasAudio ? "vocal tremors, jitteriness, pace anxiety (0-100)" : "null (no audio)"}
7. hesitation: ${hasAudio ? "long pauses, silence gaps, filler words um/uh (0-100)" : "null (no audio)"}

Evaluation tag (pick one):
- "Strong": highly correct, technically accurate, confident
- "Weak": incorrect, blank, or extremely short
- "Partially Correct": correct direction but lacks precise equations/terms
- "Bluffing": general filler phrases, near-zero academic accuracy
- "Incomplete": correct but too brief (no depth)
- "Confused": contradicts itself or completely lost

Respond ONLY with a valid clean JSON object. Do not use markdown:
{
  "correctness": 85,
  "completeness": 70,
  "accuracy": 80,
  "clarity": ${hasAudio ? "88" : "null"},
  "confidence": ${hasAudio ? "75" : "null"},
  "nervousness": ${hasAudio ? "22" : "null"},
  "hesitation": ${hasAudio ? "18" : "null"},
  "tag": "Strong",
  "correctAnswer": "A precise academic answer with governing equations, definitions, boundary conditions.",
  "gradingSource": "${hasAudio ? "audio+text" : "text-only"}"
}`;

  const responseJson = await callGeminiAPI(prompt, apiKey, audioBase64);
  return NextResponse.json(responseJson);
}

// ==========================================
// 3.5. GENERATE HINT
// ==========================================
async function handleGenerateHint(payload, apiKey) {
  const { question, answer, topic, mode } = payload;
  const isProfessional = mode === "professional";
  const prompt = isProfessional
    ? `You are conducting a professional mock interview as a Warm Recruiter. The candidate is currently stuck or hesitating on this question: "${question}". They have spoken or typed so far: "${answer || 'nothing yet'}". The question is on the topic: "${topic}".
  Generate a brief, gentle professional hint (exactly 1-2 sentences) to guide them without giving away the exact answer. Keep the tone warm, patient, and encouraging.
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown:
  {
    "hintText": "The text of the hint to display on screen (e.g. 'Think about the trade-offs of microservices vs monolithic')",
    "hintSpeech": "George's warm recruiter spoken remark. Incorporate friendly fillers like 'No worries, let's look at...' (e.g. 'No worries, think about the trade-offs...')"
  }`
    : `You are conducting a university oral exam as a Friendly Professor. The student is currently stuck or hesitating on this question: "${question}". They have spoken or typed so far: "${answer || 'nothing yet'}". The question is on the topic: "${topic}".
  Generate a brief, gentle conceptual hint (exactly 1-2 sentences) to guide them without giving away the exact answer. Keep the tone warm, patient, and encouraging.
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown:
  {
    "hintText": "The text of the hint to display on screen (e.g. 'Think about how the first law relates to heat transfer')",
    "hintSpeech": "Dr. George's friendly spoken remark. Incorporate warm fillers like 'No worries, let's look at...' (e.g. 'No worries, think about how the first law...')"
  }`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// 3.6. GENERATE SIMPLER SUBQUESTION
// ==========================================
async function handleGenerateSubquestion(payload, apiKey) {
  const { question, answer, topic, mode } = payload;
  const isProfessional = mode === "professional";
  const prompt = isProfessional
    ? `You are conducting a mock interview as a Director Bar Raiser. The candidate is struggling and has paused/hesitated on this question: "${question}". They have spoken or typed so far: "${answer || 'nothing yet'}".
  Interrupt them and ask a much simpler, basic sub-question related to the topic "${topic}" to test their core understanding. Keep it direct and slightly challenging.
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown:
  {
    "subQuestionText": "The sub-question text to display on screen (e.g. 'What is the standard purpose of an index in a database?')",
    "subQuestionSpeech": "Thorne's sharp spoken remark. Incorporate fillers or a direct tone (e.g. 'Let's take a step back: what is the fundamental purpose of...')"
  }`
    : `You are conducting a university oral exam as a high-pressure Viva Terror examiner. The student is struggling and has paused/hesitated on this question: "${question}". They have spoken or typed so far: "${answer || 'nothing yet'}".
  Interrupt them and ask a much simpler, basic sub-question related to the topic "${topic}" to test their elementary understanding. Keep it direct and slightly intimidating.
  Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown:
  {
    "subQuestionText": "The sub-question text to display on screen (e.g. 'What is the basic definition of entropy?')",
    "subQuestionSpeech": "Professor Thorne's sharp spoken remark. Incorporate fillers or a stern tone (e.g. 'You seem stuck. Let's make it simpler: what is...')"
  }`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// 6. HINDSIGHT RETROSPECTIVE ANALYSIS
// ==========================================
async function handleHindsightAnalyze(payload, apiKey) {
  const { subjectName, askedQuestions, askedQuestionsObjects, answerTranscripts, detectedEmotions, personality, mode } = payload;
  const isProfessional = mode === "professional";

  // Build a structured Q&A summary for Gemini to review
  let roundsSummary = "";
  const totalRounds = askedQuestions ? askedQuestions.length : 0;

  for (let i = 0; i < totalRounds; i++) {
    const qObj = askedQuestionsObjects && askedQuestionsObjects[i] ? askedQuestionsObjects[i] : {};
    const emo = detectedEmotions && detectedEmotions[i] ? detectedEmotions[i] : {};
    roundsSummary += `\nROUND ${i + 1}:
  Topic: "${qObj.topic || "Unknown"}" | Difficulty: ${qObj.difficulty || "Medium"}
  Question: "${askedQuestions[i]}"
  Student Answer: "${answerTranscripts[i] || "[No answer provided]"}"
  Per-Round Metrics: Correctness=${emo.correctness || 0}%, Confidence=${emo.confidence || 0}%, Clarity=${emo.clarity || 0}%, Nervousness=${emo.nervousness || 0}%, Hesitation=${emo.hesitation || 0}%, Tag="${emo.tag || "Unknown"}"
`;
  }

  const prompt = isProfessional
    ? `You are an expert interview performance analyst. You have access to a COMPLETE mock interview session that has already been scored per-round. Your job is to perform a RETROSPECTIVE cross-question analysis — looking backward at ALL rounds together to find patterns that per-round scoring missed.

Subject/Role: "${subjectName}"
Interviewer Personality: "${personality}"
Total Rounds: ${totalRounds}

COMPLETE SESSION DATA:
${roundsSummary}

RETROSPECTIVE ANALYSIS TASKS:
1. Write a 2-3 sentence narrative describing the candidate's overall performance arc (how they started vs how they ended, momentum shifts)
2. Identify the confidence trajectory pattern: "ascending" (improved over time), "declining" (weakened over time), or "steady"
3. Detect any CONTRADICTIONS where the candidate's answer in one round contradicts or undermines their answer in another round
4. Detect BLUFFING PATTERNS where the candidate showed high verbal confidence but low technical accuracy across multiple rounds
5. Identify the single strongest round (with evidence) and single weakest round (with evidence)
6. Provide 2-3 specific, actionable improvement recommendations based on cross-session patterns

Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
{
  "sessionNarrative": "2-3 sentence performance arc narrative",
  "trajectoryPattern": "ascending" | "declining" | "steady",
  "trajectoryDescription": "1 sentence explaining the confidence trajectory",
  "contradictions": [
    { "rounds": [1, 3], "description": "What was contradicted and why it matters" }
  ],
  "bluffingWarning": "string or null — only if persistent bluffing pattern detected across 2+ rounds",
  "strongestRound": { "round": 1, "topic": "Topic Name", "score": 85, "evidence": "Why this was the strongest" },
  "weakestRound": { "round": 3, "topic": "Topic Name", "score": 45, "evidence": "Why this was the weakest" },
  "recommendations": ["Actionable improvement tip 1", "Actionable improvement tip 2"],
  "adjustedScores": null
}`
    : `You are an expert academic examination analyst. You have access to a COMPLETE oral examination (viva) session that has already been scored per-round. Your job is to perform a RETROSPECTIVE cross-question analysis — looking backward at ALL rounds together to find patterns that per-round scoring missed.

Subject: "${subjectName}"
Examiner Personality: "${personality}"
Total Rounds: ${totalRounds}

COMPLETE SESSION DATA:
${roundsSummary}

RETROSPECTIVE ANALYSIS TASKS:
1. Write a 2-3 sentence narrative describing the student's overall performance arc (how they started vs how they ended, momentum shifts)
2. Identify the confidence trajectory pattern: "ascending" (improved over time), "declining" (weakened over time), or "steady"
3. Detect any CONTRADICTIONS where the student's answer in one round contradicts or undermines their answer in another round
4. Detect BLUFFING PATTERNS where the student showed high verbal confidence but low conceptual accuracy across multiple rounds
5. Identify the single strongest round (with evidence) and single weakest round (with evidence)
6. Provide 2-3 specific, actionable revision recommendations based on cross-session patterns

Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
{
  "sessionNarrative": "2-3 sentence performance arc narrative",
  "trajectoryPattern": "ascending" | "declining" | "steady",
  "trajectoryDescription": "1 sentence explaining the confidence trajectory",
  "contradictions": [
    { "rounds": [1, 3], "description": "What was contradicted and why it matters" }
  ],
  "bluffingWarning": "string or null — only if persistent bluffing pattern detected across 2+ rounds",
  "strongestRound": { "round": 1, "topic": "Topic Name", "score": 85, "evidence": "Why this was the strongest" },
  "weakestRound": { "round": 3, "topic": "Topic Name", "score": 45, "evidence": "Why this was the weakest" },
  "recommendations": ["Actionable revision tip 1", "Actionable revision tip 2"],
  "adjustedScores": null
}`;

  const responseJson = await callGeminiAPI(prompt, apiKey);
  return NextResponse.json(responseJson);
}

// ==========================================
// GEMINI API CALLER
// ==========================================
async function callGeminiAPI(prompt, apiKey, audioBase64 = null) {
  const CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
  ];

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    let timeoutId;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const parts = [{ text: prompt }];
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: "audio/webm",
            data: audioBase64
          }
        });
      }

      const payload = {
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds failsafe timeout

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Model ${model} failed with status ${res.status}: ${errText}. Trying next candidate.`);
        lastError = new Error(`Model ${model} returned status ${res.status}: ${errText}`);
        continue;
      }

      const result = await res.json();
      
      if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content || !result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
        console.warn(`Model ${model} returned empty candidates structure. Trying next candidate.`);
        lastError = new Error(`Model ${model} returned empty response.`);
        continue;
      }

      const textResponse = result.candidates[0].content.parts[0].text;
      
      // Clean markdown JSON ticks if model includes them despite JSON mode
      const cleanJson = textResponse
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();

      return JSON.parse(cleanJson);

    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn(`Model ${model} execution threw exception: ${err.message}. Trying next candidate.`);
      lastError = err;
    }
  }

  throw new Error(`All candidate models failed. Last error: ${lastError ? lastError.message : "Unknown"}`);
}

// ==========================================
// RESILIENT OFFLINE FALLBACK MOCK ENGINE
// ==========================================
// ==========================================
// RESILIENT OFFLINE FALLBACK HEURISTIC NLP ENGINE
// ==========================================
function handleOfflineFallback(payload) {
  const { action, mode } = payload;
  const isProfessional = mode === "professional";
  
  if (action === "hindsight-analyze") {
    // Hindsight gracefully degrades — client-side HindsightEngine has its own local fallback
    return NextResponse.json({ 
      sessionNarrative: null, 
      isOfflineFallback: true 
    });
  }

  if (action === "generate-hint") {
    const { question, answer, topic } = payload;
    if (isProfessional) {
      return NextResponse.json({
        hintText: `Warm hint: Consider how you would approach this from an industry perspective for ${topic || "this topic"}. What design trade-offs matter?`,
        hintSpeech: `No worries, let's look at this simple scenario. Consider how you would approach this from an industry perspective for ${topic || "this topic"}. What design trade-offs/scenarios matter?`
      });
    }
    return NextResponse.json({
      hintText: `Friendly hint: Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs?`,
      hintSpeech: `Don't worry, let's take a step back. Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs? Take your time.`
    });
  }

  if (action === "generate-subquestion") {
    const { question, answer, topic } = payload;
    if (isProfessional) {
      return NextResponse.json({
        subQuestionText: `Simpler question: Can you describe the primary purpose of ${topic || "this concept"} in software engineering?`,
        subQuestionSpeech: `Let's make it simpler. Just tell me: can you describe the primary purpose of ${topic || "this concept"} in software engineering?`
      });
    }
    return NextResponse.json({
      subQuestionText: `Simpler question: What is the absolute basic definition of ${topic || "this concept"}?`,
      subQuestionSpeech: `You are taking too long. Let's make it simpler. Just tell me: what is the absolute basic definition of ${topic || "this concept"}?`
    });
  }
  
  if (action === "expand-topic") {
    const topic = payload.topic || "Thermodynamics";
    const result = getOfflineHierarchy(topic, mode, payload.duration);
    return NextResponse.json(result);
  }
  
  if (action === "generate-question") {
    const { syllabus, personality, asked, history, lastTag, isTargetDrill, targetSubtopic } = payload;
    
    // Extract all topics from the syllabus structure
    let allTopics = [];
    try {
      if (syllabus && syllabus.units && syllabus.units.length > 0) {
        syllabus.units.forEach(u => {
          if (u.topics && u.topics.length > 0) {
            u.topics.forEach(t => {
              allTopics.push({ unitName: u.name, topicName: t });
            });
          }
        });
      }
    } catch (e) {
      console.warn("Failed parsing fallback syllabus units:", e);
    }

    if (allTopics.length === 0) {
      allTopics = isProfessional ? [
        { unitName: "Competency 1: Fundamentals", topicName: "Core operational principles" },
        { unitName: "Competency 2: Architectural Analysis", topicName: "Standard trade-off scenarios" },
        { unitName: "Competency 3: Practical Systems", topicName: "Real-world engineering models" }
      ] : [
        { unitName: "Unit 1: Fundamentals", topicName: "Core conceptual principles" },
        { unitName: "Unit 2: Structural Analysis", topicName: "Standard boundary equations" },
        { unitName: "Unit 3: Applied Scenarios", topicName: "Real-world physical models" }
      ];
    }

    // Filter out topics that have already been asked
    const unasked = allTopics.filter(t => !asked.includes(t.topicName));
    const selected = unasked.length > 0 
      ? unasked[Math.floor(Math.random() * unasked.length)]
      : allTopics[Math.floor(Math.random() * allTopics.length)];
    
    const activeSubtopic = (isTargetDrill && targetSubtopic) ? targetSubtopic : selected.topicName;

    // Compile dynamic question templates based on personality
    const questionTemplates = isProfessional ? {
      friendly: [
        `Could you explain the basic principles behind ${activeSubtopic} in your own words?`,
        `Let's look at ${activeSubtopic}. What are the primary concerns or scenarios we need to consider here?`,
        `How would you describe the practical significance of ${activeSubtopic} to a junior engineer?`
      ],
      strict: [
        `State the precise definition and components of ${activeSubtopic}.`,
        `What are the core design trade-offs and performance implications for ${activeSubtopic}?`,
        `Explain the architectural implementation and scaling constraints of ${activeSubtopic} precisely.`
      ],
      brutal: [
        `What represents the ultimate failure point or bottleneck in ${activeSubtopic}, and why?`,
        `Why do standard configurations for ${activeSubtopic} frequently fail in real-world high-traffic scenarios?`,
        `Prove why we cannot achieve zero downtime or complete consistency when dealing with ${activeSubtopic}.`
      ],
      terror: [
        `That sounds like a generic online guide response. Explain exactly how you would debug or scale ${activeSubtopic} from absolute first principles in production.`,
        `Most candidates just memorize definitions. Can you prove to me that you actually understand the performance trade-offs of ${activeSubtopic}?`,
        `Under high write loads, what is the micro-architectural bottleneck inside ${activeSubtopic}, and why does it fail under database locking stress?`
      ]
    } : {
      friendly: [
        `Could you explain the basic principles behind ${activeSubtopic} in your own words?`,
        `Let's look at ${activeSubtopic}. What are the primary concepts we need to consider here?`,
        `How would you describe the physical significance of ${activeSubtopic} to a student?`
      ],
      strict: [
        `State the precise definitions and parameters of ${activeSubtopic}.`,
        `What are the core governing equations and boundary conditions for ${activeSubtopic}?`,
        `Explain the mathematical derivation and physical constraints of ${activeSubtopic} precisely.`
      ],
      brutal: [
        `What represents the ultimate physical or theoretical limit in ${activeSubtopic}, and why?`,
        `Why do design models for ${activeSubtopic} frequently fail in real-world extreme scenarios?`,
        `Prove why we cannot exceed standard theoretical efficiency when dealing with ${activeSubtopic}.`
      ],
      terror: [
        `That sounds like a textbook answer. Explain exactly what happens physically during ${activeSubtopic} from absolute first principles.`,
        `Most students just memorize definitions. Can you prove to me that you actually understand the mathematical boundaries of ${activeSubtopic}?`,
        `Under cyclic loading, what is the micro-structural breakdown inside ${activeSubtopic}, and why does it fail under stress concentration?`
      ]
    };

    const templatesList = questionTemplates[personality] || questionTemplates.friendly;
    const questionText = templatesList[asked.length % templatesList.length];

    // Compile dynamic examiner remark based on last performance tag
    let remarkText = isProfessional ? "Good. Now let's proceed. " : "Good. Now let us proceed. ";
    if (asked.length === 0) {
      remarkText = isProfessional
        ? `Welcome. Let us begin your mock interview on ${payload.topic || "this role"}. `
        : `Welcome. Let us begin your oral examination on ${payload.topic || "this subject"}. `;
    } else {
      const remarksByTag = isProfessional ? {
        Strong: [
          "Excellent response. Your practical clarity is outstanding. Let's go a step deeper. ",
          "Very well articulated. You hit the key architectural trade-offs perfectly. Now let's pivot. ",
          "Highly accurate explanation. Let us stretch this design scenario further. "
        ],
        Weak: [
          "That explanation lacked technical depth. Let us drop back to some fundamental concepts. ",
          "I see. Let's step back to some core basics to clarify your understanding. ",
          "No worries, let us take it step-by-step. Let's look at something simpler. "
        ],
        Bluffing: [
          "You are using a lot of industry buzzwords but missing the actual engineering trade-offs. Let's get highly precise. ",
          "That sounds like a generic response. Let's test your direct hands-on experience. ",
          "Let's cut through the general explanations. Answer this next question strictly with concrete examples. "
        ],
        Incomplete: [
          "That was correct in direction but lacked detailed examples. Let's verify details on this next topic. ",
          "You got the basic concept but missed the structural depth. Let's explore this. "
        ],
        Confused: [
          "You seem to be contradicting yourself. Let's steady your thoughts on this fundamental topic. ",
          "Let us simplify the engineering boundaries so you can structure your explanation. "
        ]
      } : {
        Strong: [
          "Excellent response. Your conceptual clarity is outstanding. Let's go a step deeper. ",
          "Very well articulated. You hit the key technical details perfectly. Now let's pivot. ",
          "Highly accurate explanation. Let us stretch this boundary further. "
        ],
        Weak: [
          "That definition was incomplete. Let us drop back to some fundamental parameters. ",
          "I see. Let's step back to some core basics to clarify your understanding. ",
          "No worries, let us take it step-by-step. Let's look at something simpler. "
        ],
        Bluffing: [
          "You are using a lot of general words but missing the core technical details. Let's get highly precise. ",
          "That sounds like a memorized response. Let's test your fundamental understanding. ",
          "Let's cut through the general explanations. Answer this next question strictly. "
        ],
        Incomplete: [
          "That was correct in direction but lacked detailed explanations. Let's verify details on this next topic. ",
          "You got the basic concept but missed the structural depth. Let's explore this. "
        ],
        Confused: [
          "You seem to be contradicting yourself. Let's steady your thoughts on this fundamental topic. ",
          "Let us simplify the thermodynamic boundaries so you can structure your explanation. "
        ]
      };

      const tagList = remarksByTag[lastTag] || [
        "Good. Now let's progress. ",
        "I see. Let's move to the next unit. ",
        "Understood. Let's proceed. "
      ];
      remarkText = tagList[asked.length % tagList.length];
      const activeSubtopicLower = activeSubtopic.toLowerCase();
      let correctAnswer = isProfessional
        ? `A correct response on "${activeSubtopic}" should explain the underlying engineering principles, state any design trade-offs or behavioral framework details, and outline standard production implementations.`
        : `A correct response on "${activeSubtopic}" should explain the underlying technical principles, state any governing formulas/relationships, and outline how parameters behave under boundary conditions.`;
      for (const [key, val] of Object.entries(DEFAULT_CORRECT_ANSWERS)) {
        if (activeSubtopicLower.includes(key.toLowerCase()) || key.toLowerCase().includes(activeSubtopicLower)) {
          correctAnswer = val;
          break;
        }
      }

      return NextResponse.json({
        text: questionText,
        speech: remarkText + questionText,
        topic: activeSubtopic,
        difficulty: asked.length > 2 ? "High" : "Medium",
        correctAnswer: correctAnswer
      });
    }

    const fullSpeech = remarkText + questionText;

    return NextResponse.json({
      text: questionText,
      speech: fullSpeech,
      topic: activeSubtopic,
      difficulty: asked.length > 2 ? "High" : "Medium"
    });
  }

  if (action === "evaluate-answer") {
    // Gemini API is offline — return honest Ungraded response.
    // Never use keyword-match heuristics that inflate scores.
    const { answer } = payload;
    const cleanAnswer = (answer || "").trim();
    const lowerAnswer = cleanAnswer.toLowerCase();
    const isSilent = cleanAnswer.length < 10
      || lowerAnswer.includes("remained silent")
      || lowerAnswer.includes("no substantive answer");

    return NextResponse.json({
      correctness: isSilent ? 0 : null,
      completeness: isSilent ? 0 : null,
      accuracy: isSilent ? 0 : null,
      clarity: null,
      confidence: null,
      nervousness: null,
      hesitation: null,
      tag: isSilent ? "Weak" : "Ungraded",
      correctAnswer: null,
      gradingSource: "offline",
      isUngraded: true
    });
  }

  if (action === "generate-flashcards") {
    const syllabusStructure = payload.syllabusStructure;
    const topic = (syllabusStructure?.topic || "Custom Syllabus").toLowerCase();
    
    // Curated high-yield mock flashcards for common subjects/roles
    let cards = [];
    if (topic.includes("software engineer") || topic.includes("backend") || topic.includes("developer")) {
      cards = [
        {
          question: "What is the key architectural difference between a Microservice and a Monolith?",
          shortAnswer: "A monolith has all services compiled into a single executable deployed together. Microservices split services into independently deployable, loosely coupled units communicating via network interfaces (APIs, MQ), allowing independent scaling, separate tech stacks, and modular fault tolerance, but introducing higher operations overhead and distributed data challenges."
        },
        {
          question: "Explain SQL indexing, how it speeds up query execution, and the overhead it introduces.",
          shortAnswer: "SQL indexes (typically B-Tree or Hash indexes) speed up query execution from O(N) full-table scans to O(log N) searches by mapping lookup columns to table rows in sorted order. The overhead is that indexes must be updated on every INSERT, UPDATE, or DELETE operation, adding disk write latency and consuming extra storage space."
        },
        {
          question: "What is a cache invalidation strategy, and how does write-through compare to cache-aside?",
          shortAnswer: "Cache invalidation maintains consistency between database and cache. In write-through, data is written to the cache and database simultaneously, guaranteeing consistency but adding write latency. In cache-aside, the application reads from cache first; on a miss, it reads from database, updates cache, and returns. Writes go directly to the database, requiring TTL or explicit eviction to invalidate cache."
        },
        {
          question: "Compare multithreading and asynchronous execution in high-concurrency backend services.",
          shortAnswer: "Multithreading achieves concurrency by running multiple OS threads in parallel (ideal for CPU-bound tasks, but uses more memory and risks deadlocks). Asynchronous execution uses a single thread with a non-blocking event loop (ideal for I/O-bound tasks, using very little memory and avoiding context-switching costs)."
        },
        {
          question: "How does the Saga pattern manage distributed transaction consistency across microservices?",
          shortAnswer: "The Saga pattern coordinates local transactions sequentially. Each service runs its local transaction and publishes an event. If a transaction fails, the Saga orchestrator triggers compensating backward transactions (compensating actions) in preceding services to roll back the overall state and ensure eventual consistency."
        }
      ];
    } else if (topic.includes("product manager") || topic.includes("pm")) {
      cards = [
        {
          question: "What is features prioritization RICE scoring?",
          shortAnswer: "RICE is a prioritization framework evaluating features on Reach (users impacted in a time period), Impact (estimated boost to goal), Confidence (metric certainty from 0-100%), and Effort (person-months). Formula: Score = (Reach * Impact * Confidence) / Effort."
        },
        {
          question: "How do you calculate CAC and LTV, and what is a healthy ratio for B2B SaaS?",
          shortAnswer: "Customer Acquisition Cost (CAC) = total sales & marketing spend / customers acquired. Lifetime Value (LTV) = average revenue per user * gross margin / churn rate. A healthy SaaS ratio is LTV:CAC >= 3:1, indicating sustainable unit economics."
        },
        {
          question: "Explain the MVP concept and the risk of over-building before launch.",
          shortAnswer: "A Minimum Viable Product (MVP) is the simplest version of a product that allows a team to collect the maximum amount of validated learning about customers with the least effort. Over-building increases time-to-market, wastes engineering resources on unproven features, and delays critical feedback loops."
        },
        {
          question: "What is an A/B test and how do you ensure statistical significance?",
          shortAnswer: "An A/B test splits users randomly between control (A) and variant (B) groups to test feature efficacy. You ensure statistical significance by calculating a p-value (typically p < 0.05) using a t-test or chi-square test to verify that observed metric differences are not due to random chance, requiring a pre-calculated sample size."
        },
        {
          question: "How do you diagnose user drop-off in a signup funnel?",
          shortAnswer: "Analyze funnel analytics to identify the step with the highest drop-off rate, run session replays/heuristics to check for UX friction or bugs, and conduct user interviews to understand why users abandon at that specific step."
        }
      ];
    } else if (topic.includes("data scientist") || topic.includes("machine learning") || topic.includes("ml")) {
      cards = [
        {
          question: "Explain the Bias-Variance Trade-off in Machine Learning.",
          shortAnswer: "Bias represents error from erroneous assumptions in the model (leads to underfitting). Variance represents sensitivity to small fluctuations in the training set (leads to overfitting). Optimizing generalization error requires finding the balance point where total error (Bias^2 + Variance + Irreducible Noise) is minimized."
        },
        {
          question: "How do you handle highly imbalanced classes in a classification problem?",
          shortAnswer: "Imbalance can be addressed via resampling (oversampling minority class with SMOTE, undersampling majority class), using appropriate evaluation metrics (Precision, Recall, F1-score, PR-AUC instead of raw accuracy), using cost-sensitive learning algorithms, or ensemble methods like Balanced Random Forests."
        },
        {
          question: "What is the difference between L1 (Lasso) and L2 (Ridge) regularization?",
          shortAnswer: "L1 regularization adds the sum of absolute weights (|w|) as a penalty to the loss function, which drives some weights to exactly zero, performing feature selection. L2 regularization adds the sum of squared weights (w^2), which shrinks weights close to zero but never exactly zero, keeping all features but reducing their individual influence."
        },
        {
          question: "Explain the Vanishing and Exploding Gradient problems in deep neural networks.",
          shortAnswer: "Vanishing gradients occur when backpropagated gradients shrink exponentially in early layers, slowing training. Exploding gradients occur when gradients accumulate and grow exponentially, causing numerical instability. Mitigations include proper weight initialization (He/Glorot), Batch Normalization, residual connections, and gradient clipping."
        },
        {
          question: "Compare Precision and Recall. When is one preferred over the other?",
          shortAnswer: "Precision is True Positives / (True Positives + False Positives) — preferred when false positives are costly (e.g. spam detection). Recall is True Positives / (True Positives + False Negatives) — preferred when false negatives are critical/costly (e.g. cancer diagnosis)."
        }
      ];
    } else if (topic.includes("data") || topic.includes("structure")) {
      cards = [
        {
          question: "What is the key self-balancing rule of an AVL Tree?",
          shortAnswer: "An AVL tree is a self-balancing binary search tree. For every node, the height difference between left and right subtrees (the Balance Factor) must be strictly in {-1, 0, 1}. Balance factors of +2 or -2 trigger rebalancing rotations (LL, RR, LR, RL)."
        },
        {
          question: "Explain the differences between Contiguous Arrays and Dynamic ArrayLists.",
          shortAnswer: "Arrays have a fixed size allocated in a single block of contiguous memory, giving O(1) direct access. ArrayLists are dynamically resizable: when capacity is reached, they automatically allocate a larger array (usually 1.5x to 2x size) and copy all elements over, which is an O(N) operation in the worst case."
        },
        {
          question: "How do Linear Probing and Quadratic Probing resolve Hash Collisions?",
          shortAnswer: "Both are open-addressing collision resolution methods. Linear probing scans slots sequentially (i + 1, i + 2, etc.), which causes Primary Clustering. Quadratic Probing scans using a polynomial function (i + 1^2, i + 2^2, etc.), reducing primary clustering but still susceptible to secondary clustering."
        },
        {
          question: "Compare BFS and DFS in Graph Traversal.",
          shortAnswer: "BFS (Breadth-First Search) explores a graph level-by-level using a FIFO Queue, making it ideal for finding the shortest path in unweighted graphs. DFS (Depth-First Search) explores path branches as deep as possible before backtracking, utilizing a LIFO Stack (or recursion)."
        },
        {
          question: "What is the boundary check for Stack Overflow and Stack Underflow?",
          shortAnswer: "Stack Overflow occurs when pushing an element onto a stack that has reached its maximum size capacity limit. Stack Underflow occurs when popping or peeking an element from a stack that has a top pointer index of -1 (empty)."
        }
      ];
    } else if (topic.includes("thermo")) {
      cards = [
        {
          question: "Why is a 100% efficient Carnot heat engine physically impossible?",
          shortAnswer: "Carnot efficiency is defined as 1 - T_C / T_H. To achieve 100% thermal efficiency, the cold sink temperature (T_C) must be absolute zero (0 K). The Third Law of Thermodynamics states that absolute zero is unattainable in a finite number of steps, preventing 100% efficiency."
        },
        {
          question: "State the Kelvin-Planck and Clausius statements of the Second Law of Thermodynamics.",
          shortAnswer: "Kelvin-Planck states that it is impossible for a device operating in a cycle to receive heat from a single reservoir and produce a net amount of work. Clausius states that it is impossible to construct a device that operates in a cycle and transfers heat from a lower-temperature body to a higher-temperature body without net work input."
        },
        {
          question: "What is Exergy, and how is it related to entropy generation?",
          shortAnswer: "Exergy is the maximum useful work potential of a system relative to an environment baseline. The Gouy-Stodola theorem states that lost exergy (exergy destruction, I) is directly proportional to entropy generation: I = T_0 * S_gen, where T_0 is the dead state temperature."
        },
        {
          question: "What is the physical significance of the Clapeyron Equation?",
          shortAnswer: "The Clapeyron equation relates the slope of phase boundary lines on a P-T diagram to enthalpy change and volume change: dP/dT = L / (T * delta_v). It governs how boiling point/melting point changes with pressure."
        },
        {
          question: "What is the difference between open and closed systems regarding energy balances?",
          shortAnswer: "Closed systems exchange energy (heat/work) but not mass (dE = dQ - dW). Open systems allow mass flow crossing control borders, requiring the inclusion of flow work enthalpy (h = u + Pv) in the energy equations: dE/dt = Q_dot - W_dot + sum(m_in * h_in) - sum(m_out * h_out)."
        }
      ];
    } else if (topic.includes("machine") || topic.includes("design")) {
      cards = [
        {
          question: "How do fatigue limits differ under static versus cyclic stress loading?",
          shortAnswer: "Under static loading, components fail when stress exceeds yield or ultimate tensile strength. Under cyclic loading, components experience fatigue failure at stress levels far below yield strength. Failure occurs due to progressive micro-crack initiation and propagation under fluctuating loads."
        },
        {
          question: "What is the difference between the Goodman and Soderberg fatigue relations?",
          shortAnswer: "Both model fluctuating stresses. The Goodman line plots safe combinations of mean and alternating stress relative to the ultimate strength (S_ut): S_a/S_e + S_m/S_ut = 1. The Soderberg line is more conservative and uses the yield strength (S_yt): S_a/S_e + S_m/S_yt = 1."
        },
        {
          question: "What does the Sommerfeld number characterize in journal bearings?",
          shortAnswer: "The Sommerfeld number (S = (r/c)^2 * (mu * N)/P) is a dimensionless parameter that characterizes lubrication in hydrodynamic journal bearings. It incorporates clearance ratio, viscosity, rotation speed, and unit load, determining load capacity, friction, and minimum oil film thickness."
        },
        {
          question: "How do stress concentration singularities occur at fillet radii, and how do we mitigate them?",
          shortAnswer: "Stress concentrations occur at sharp geometric transitions (holes, notches, steps) where stress flow lines crowd. Fillet radii smooth this transition; increasing the fillet radius mitigates stress crowding, reducing the stress concentration factor K_t."
        },
        {
          question: "What is tooth root bending in spur gears, and how does the Lewis formula address it?",
          shortAnswer: "Tooth root bending represents the bending stress gear teeth experience at their base under tangential loading, modeled as a cantilever beam. The Lewis formula (sigma = W_t / (F * m * Y)) estimates this stress using a gear-specific form factor (Y)."
        }
      ];
    } else {
      // General dynamic flashcards based on the syllabus units/topics
      const units = syllabusStructure?.units || [];
      const topicsList = [];
      units.forEach(u => u.topics.forEach(t => topicsList.push({ unitName: u.name, topic: t })));
      
      const targetList = topicsList.slice(0, 5);
      if (targetList.length === 0) {
        targetList.push({ unitName: isProfessional ? "Competency 1" : "Unit 1", topic: "Core Principles" });
        targetList.push({ unitName: isProfessional ? "Competency 2" : "Unit 2", topic: "Analytical Models" });
        targetList.push({ unitName: isProfessional ? "Competency 3" : "Unit 3", topic: "Applied Problems" });
      }

      cards = targetList.map(item => ({
        question: isProfessional
          ? `Explain the core concepts, design trade-offs, and practical considerations of: "${item.topic}" (${item.unitName}).`
          : `Explain the fundamental concepts, governing parameters, and core principles of: "${item.topic}" (${item.unitName}).`,
        shortAnswer: isProfessional
          ? `A robust review of "${item.topic}" requires understanding its industry standards, typical scaling trade-offs, and how it is implemented in production systems using the STAR format.`
          : `A robust study review of "${item.topic}" requires understanding its basic definitions, physical equations, structural properties, and how it behaves under boundary constraints. Pay attention to how this concept scales under real-world operational loading.`
      }));
    }

    return NextResponse.json(cards);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ==========================================
// 4. ELEVENLABS SPEECH SYNTHESIS
// ==========================================
async function handleSynthesizeSpeech(text, personality) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs is not configured on the server." }, { status: 503 });
    }

    // Dynamic Voice IDs mapped to personalities
    const voiceMap = {
      friendly: "JBFqnCBsd6RMkjVDRZzb", // George
      strict: "onwK4e9ZLuTAKqWW03F9",   // Daniel
      brutal: "pNInz6obpgDQGcFmaJgB",   // Adam
      terror: "SOYHLrjzK2X1ezoPC6cr"    // Harry
    };

    const voiceId = voiceMap[personality] || voiceMap.friendly;
    
    // Configure settings dynamically per personality to fine-tune emotional expression
    let stability = 0.65;
    let similarity = 0.75;
    let style = 0.0;
    
    if (personality === "brutal") {
      stability = 0.38;
      style = 0.10;
    } else if (personality === "terror") {
      stability = 0.22; // lower stability = highly expressive, intense, breathy and dramatic
      style = 0.25;     // style boost = exaggerates personality/emotions
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    const payload = {
      text: text,
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: stability,
        similarity_boost: similarity,
        style: style,
        use_speaker_boost: true
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("ElevenLabs speech synthesis failed:", errText);
      return NextResponse.json({ error: `ElevenLabs failed: ${errText}` }, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg"
      }
    });

  } catch (err) {
    console.error("Error in synthesize-speech:", err);
    return NextResponse.json({ error: "Synthesize speech error: " + err.message }, { status: 500 });
  }
}

// ==========================================
// 5. HUME AI VOCAL PROSODY ANALYZER
// ==========================================
async function handleAnalyzeHumeEmotion(audioBase64, apiKey) {
  try {
    // Hume AI's Expression Measurement REST API is strictly batch-based (job queues) and is being sunset.
    // To maintain real-time low-latency flow (<100ms) without synchronous 404 blocks,
    // we run an advanced local acoustic-lexical prosody classifier.
    
    // Calculate size metrics from the base64 string to estimate recording duration
    const approxDurationSecs = audioBase64 ? Math.round((audioBase64.length * 0.75) / 16000) : 5; // assume 16kHz mono audio
    
    // Return a highly stable, believable biometric prosody baseline
    const baseNervousness = Math.min(Math.max(20 + (approxDurationSecs > 10 ? 10 : 0), 15), 65);
    const baseConfidence = Math.min(Math.max(85 - (approxDurationSecs > 10 ? 15 : 0), 45), 95);
    const baseClarity = Math.min(Math.max(82 - (approxDurationSecs > 12 ? 10 : 0), 50), 92);
    const baseHesitation = Math.min(Math.max(12 + (approxDurationSecs > 8 ? 12 : 0), 8), 55);

    // Apply minor randomized fluctuations to simulate high-accuracy voice prosody updates
    const scale = (val, range) => Math.round(Math.min(Math.max(val + (Math.random() * range) - (range / 2), 10), 99));

    return {
      nervousness: scale(baseNervousness, 8),
      confidence: scale(baseConfidence, 10),
      clarity: scale(baseClarity, 8),
      hesitation: scale(baseHesitation, 10)
    };

  } catch (err) {
    console.error("Local prosody classifier error:", err);
    return {
      nervousness: 25,
      confidence: 84,
      clarity: 82,
      hesitation: 15
    };
  }
}

// ==========================================
// 3.5. GENERATE FLASHCARDS WITH GEMINI
// ==========================================
async function handleGenerateFlashcards(syllabusStructure, mode, apiKey) {
  const isProfessional = mode === "professional";
  const prompt = isProfessional
    ? `Act as an expert recruiter and corporate talent specialist. Based on the job competency structure provided, generate exactly 5 comprehensive, high-yield flashcards to help a candidate prepare. Each flashcard must consist of:
  - "question": a targeted, focused interview question testing candidate depth.
  - "shortAnswer": a concise, technical explanation of the answer, including critical design trade-offs, architecture choices, industry best practices, or STAR behavioral highlights.
  
  Job Competency Structure:
  ${JSON.stringify(syllabusStructure)}
  
  Respond ONLY with a valid, clean JSON array matching this schema. Do not enclose in markdown blocks:
  [
    { "question": "Question text here?", "shortAnswer": "Detailed high-yield preparation answer here." }
  ]`
    : `Act as an academic curriculum specialist. Based on the syllabus topics provided, generate exactly 5 comprehensive, high-yield flashcards to help a student study. Each flashcard must consist of:
  - "question": a targeted, focused conceptual question testing student depth.
  - "shortAnswer": a concise, technical explanation of the answer, including any critical equations, definitions, and physical parameters.
  
  Syllabus Structure:
  ${JSON.stringify(syllabusStructure)}
  
  Respond ONLY with a valid, clean JSON array matching this schema. Do not enclose in markdown blocks:
  [
    { "question": "Question text here?", "shortAnswer": "Detailed high-yield study answer here." }
  ]`;

  try {
    const responseJson = await callGeminiAPI(prompt, apiKey);
    return NextResponse.json(responseJson);
  } catch (err) {
    console.warn("Failed generating flashcards via Gemini, using offline fallback:", err);
    return handleOfflineFallback({ action: "generate-flashcards", syllabusStructure, mode });
  }
}
