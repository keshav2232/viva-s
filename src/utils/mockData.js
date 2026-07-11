/**
 * VivaSim - ES6 Exported Mock Database & Asset Preloads
 * Contains rich historical sessions, configurations, personality matrices,
 * and high-fidelity subject question transcripts for realistic simulation.
 * Optimized for React and dynamic imports.
 */

export const INITIAL_STATS = {
  totalVivas: 12,
  avgConfidence: 84,
  strongestSubject: "Data Structures",
  weakestSubject: "Thermodynamics"
};

export const EMPTY_STATS = {
  totalVivas: 0,
  avgConfidence: 0,
  strongestSubject: "None yet",
  weakestSubject: "None yet"
};

export const DEFAULT_SESSIONS = [
  {
    id: "session_101",
    subject: "Data Structures",
    duration: 10,
    personality: "Strict Professor",
    score: 92,
    date: "May 24, 2026",
    gradeClass: "high"
  },
  {
    id: "session_102",
    subject: "Computer Networks",
    duration: 15,
    personality: "Friendly Professor",
    score: 87,
    date: "May 20, 2026",
    gradeClass: "high"
  },
  {
    id: "session_103",
    subject: "Thermodynamics",
    duration: 5,
    personality: "Brutal External",
    score: 68,
    date: "May 15, 2026",
    gradeClass: "med"
  },
  {
    id: "session_104",
    subject: "Machine Design",
    duration: 20,
    personality: "Viva Terror",
    score: 74,
    date: "May 10, 2026",
    gradeClass: "med"
  }
];

export const EXAMINER_PERSONALITIES = {
  friendly: {
    name: "Friendly Professor",
    icon: `<path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"></path><path d="M18 21a6 6 0 0 0-12 0"></path><circle cx="12" cy="10" r="1" fill="currentColor"></circle>`,
    speed: 120, // typing/speaking speed indicator (ms per word)
    description: "Encouraging, patient, hints included.",
    attributes: { patience: "High", strictness: "Mild", stressLevel: "Low" }
  },
  strict: {
    name: "Strict Professor",
    icon: `<path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"></path><path d="M18 21a6 6 0 0 0-12 0"></path><line x1="8" y1="11" x2="16" y2="11"></line>`,
    speed: 80,
    description: "Professional, interrupting, demanding precision.",
    attributes: { patience: "Moderate", strictness: "High", stressLevel: "Moderate" }
  },
  brutal: {
    name: "Brutal External Examiner",
    icon: `<path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"></path><path d="M18 21a6 6 0 0 0-12 0"></path><polygon points="12 4 10 8 14 8"></polygon>`,
    speed: 60,
    description: "High pressure, confidence testing, tricky follow-ups.",
    attributes: { patience: "Low", strictness: "Extreme", stressLevel: "High" }
  },
  terror: {
    name: "Viva Terror",
    icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`,
    speed: 50,
    description: "Very hard, intimidating, cross-questioning.",
    attributes: { patience: "Zero", strictness: "Unforgiving", stressLevel: "Maximum" }
  }
};

export const DEFAULT_HIERARCHIES = {
  software: {
    topic: "Software Engineer (Backend)",
    units: [
      { name: "Competency 1: System Design & Architecture", topics: ["Microservices vs Monoliths", "Scalability & Load Balancing", "Database Replication & Caching", "Message Queuing & Eventual Consistency"] },
      { name: "Competency 2: Algorithms & Concurrency", topics: ["High-Concurrency Execution", "Thread Pool Deadlocks", "Data Structures Complexity", "Asynchronous Processing Loops"] },
      { name: "Competency 3: Databases & Integrity", topics: ["SQL Indexing Performance", "NoSQL vs Relational Storage", "Distributed Transaction Sagas", "Cache Invalidation Strategies"] },
      { name: "Competency 4: Testing & CI/CD Pipelines", topics: ["Unit and Integration Testing", "Automated Build Workflows", "Containerization & Docker", "Blue-Green Deployments"] },
      { name: "Competency 5: API Security & Protocols", topics: ["OAuth2 & JWT Authentication", "Rate Limiting & Throttling", "HTTPS & TLS Handshakes", "CORS & Security Headers"] }
    ]
  },
  pm: {
    topic: "Product Manager",
    units: [
      { name: "Competency 1: Product Strategy & Prioritization", topics: ["Feature Prioritization Frameworks", "MVP Scope Definition", "Market Opportunity Analysis", "Go-To-Market Plans"] },
      { name: "Competency 2: Execution Analytics & Funnels", topics: ["A/B Testing Significance", "Funnel Conversion Optimization", "Onboarding Drop-off Diagnostics", "Retention Loop Design"] },
      { name: "Competency 3: Business & Product Metrics", topics: ["Customer Acquisition Cost", "Customer Lifetime Value", "North Star Metrics", "Churn Rate Analysis"] },
      { name: "Competency 4: User Research & Personas", topics: ["Qualitative Interview Techniques", "User Journey Mapping", "Usability Test Feedback", "Persona Segmentation Design"] },
      { name: "Competency 5: Roadmap & Stakeholder Alignment", topics: ["Quarterly OKR Planning", "Cross-Functional Cooperation", "Feature Defending Arguments", "Product Lifecycle Management"] }
    ]
  },
  dataScientist: {
    topic: "Data Scientist",
    units: [
      { name: "Competency 1: ML Model Fundamentals", topics: ["Supervised vs Unsupervised Models", "Bias-Variance Trade-off", "Regularization L1/L2/Dropout", "Model Overfitting Diagnostics"] },
      { name: "Competency 2: Data Engineering & Quality", topics: ["Feature Engineering Pipelines", "Imbalanced Class Strategies", "Outlier & Missing Data Handling", "Dimensionality Reduction PCA"] },
      { name: "Competency 3: Advanced Deep Learning", topics: ["Gradient Vanishing/Explosion", "Residual Connection Functions", "Precision vs Recall Balance", "Evaluation Metrics F1-score"] },
      { name: "Competency 4: Natural Language Processing", topics: ["Tokenization & Embeddings", "Transformer Self-Attention", "Large Language Model Tuning", "Text Classification Models"] },
      { name: "Competency 5: Model Deployment & MLOps", topics: ["Real-time Inference APIs", "Model Drift & Monitoring", "Batch Prediction Pipelines", "A/B Testing ML Models"] }
    ]
  },
  dataStructures: {
    topic: "Data Structures",
    units: [
      { name: "Unit 1: Linear Data Structures", topics: ["Arrays & Arraylists", "Stack LIFO limits", "Queue FIFO indices", "Linked list traversal"] },
      { name: "Unit 2: Non-Linear Structures", topics: ["Binary Search Trees", "AVL self-balancing balance factor", "Red-black trees", "Graph representations"] },
      { name: "Unit 3: Algorithms & Hashing", topics: ["Hash collisions buckets", "Probing techniques", "Graph BFS queues", "DFS recursive stacks"] },
      { name: "Unit 4: Advanced Trees & Tries", topics: ["B-Trees & B+ Trees", "Trie prefix searches", "Segment tree range queries", "Heap priority queues"] },
      { name: "Unit 5: Dynamic Programming", topics: ["Memoization vs Tabulation", "Knapsack optimization", "Longest common subsequence", "State transition matrices"] }
    ]
  },
  machineDesign: {
    topic: "Machine Design",
    units: [
      { name: "Unit 1: Structural Static & Fatigue Loading", topics: ["Static stress limits", "Alternating stress fatigue", "Goodman line diagrams", "Soderberg yield boundaries"] },
      { name: "Unit 2: Shafts & stress Concentrations", topics: ["Torsional stress shafts", "Stress flow singularties", "Fillet radii mitigation", "Shaft keys grooves"] },
      { name: "Unit 3: Bearings & Gears", topics: ["Sommerfeld lubrication coefficient", "Journal bearings eccentricity", "Spur root teeth bending", "Lewis stress AGMA values"] },
      { name: "Unit 4: Fasteners & Welded Joints", topics: ["Threaded bolt preloads", "Welded joint throat stresses", "Riveted connection shears", "Eccentric loading limits"] },
      { name: "Unit 5: Springs & Clutches", topics: ["Helical spring deflection", "Belleville spring stacks", "Uniform wear clutch torque", "Uniform pressure brake capacity"] }
    ]
  },
  thermodynamics: {
    topic: "Thermodynamics",
    units: [
      { name: "Unit 1: Fundamental Laws", topics: ["Energy conservation balances", "Kelvin-Planck statements", "Clausius cyclic inequalities", "Second law limitations"] },
      { name: "Unit 2: Ideal Cycles & Entropy", topics: ["Carnot thermal boundaries", "Reversible entropy degradation", "Lost exergy work", "Third law absolute zero"] },
      { name: "Unit 3: Advanced Applications", topics: ["Clapeyron phase slopes", "Maxwell boundary conversions", "Open control masses", "Closed piston borders"] },
      { name: "Unit 4: Gas Power & Refrigeration", topics: ["Otto and Diesel air standards", "Rankine steam regenerations", "Brayton gas turbine stages", "Vapor compression COP values"] },
      { name: "Unit 5: Chemical & Phase Equilibrium", topics: ["Gibbs phase rule components", "Chemical potential gradients", "Fugacity activity coefficients", "Combustion stoichiometry balances"] }
    ]
  }
};

export function getFallbackSyllabus(topic, isProfessional = false) {
  const lower = (topic || "").toLowerCase();
  let key = "";
  if (lower.includes("software") || lower.includes("backend") || lower.includes("engineer") || lower.includes("developer")) {
    key = "software";
  } else if (lower.includes("product manager") || lower.includes("pm")) {
    key = "pm";
  } else if (lower.includes("data scientist") || lower.includes("machine learning") || lower.includes("ml")) {
    key = "dataScientist";
  } else if (lower.includes("data") || lower.includes("structure")) {
    key = "dataStructures";
  } else if (lower.includes("machine") || lower.includes("design")) {
    key = "machineDesign";
  } else if (lower.includes("thermodynamics") || lower.includes("thermo")) {
    key = "thermodynamics";
  }

  if (key && DEFAULT_HIERARCHIES[key]) {
    return DEFAULT_HIERARCHIES[key];
  }

  // Generic fallback if not matched
  const formalSubject = topic ? (topic.charAt(0).toUpperCase() + topic.slice(1)) : "Custom Subject";
  return {
    topic: formalSubject,
    units: isProfessional ? [
      { name: "Competency 1: Foundational Principles", topics: [`Introduction to ${formalSubject}`, "Core terminology", "Basic practical settings"] },
      { name: "Competency 2: Advanced Design Analysis", topics: ["Secondary parameters", "Detailed operational scenarios", "Engineering trade-offs"] },
      { name: "Competency 3: Real-world Integrations", topics: ["System optimization limits", "Practical case studies", "Performance analysis"] },
      { name: "Competency 4: Failure Modes & Debugging", topics: ["Root cause analysis", "System diagnostics", "Troubleshooting procedures"] },
      { name: "Competency 5: Future Scalability & Architecture", topics: ["Scalability planning", "Alternative designs", "Emerging framework patterns"] }
    ] : [
      { name: "Unit 1: Foundational Principles", topics: [`Introduction to ${formalSubject}`, "Core terminology", "Basic boundary conditions"] },
      { name: "Unit 2: Advanced Conceptual Analysis", topics: ["Secondary parameters", "Detailed structural models", "Analytical derivations"] },
      { name: "Unit 3: Applied Real-world Scenarios", topics: ["System optimization limits", "Practical integration examples", "Analytical evaluations"] },
      { name: "Unit 4: Edge Cases & Diagnostics", topics: ["Failure mode diagnostics", "System bottlenecks", "Scalability limitations"] },
      { name: "Unit 5: Future Outlook & Standards", topics: ["Emerging methodologies", "Alternative architectures", "Industry standards"] }
    ]
  };
}

export const DUMMY_SYLLABUS = `
Course Code: ME-302
Subject: Advanced Applied Thermodynamics
Live Exam Coverage:
1. Laws of Thermodynamics: First law energy balance, Second law limitations, entropy generation, exergy analysis, Clausius inequality.
2. Thermodynamic Cycles: Carnot cycle limitations, Rankine vapor cycle, reheating and regeneration, Brayton gas turbine cycle.
3. Bearings & Fluid Cycles: Phase diagrams, Clapeyron phase boundaries, Maxwell relations, enthalpy transformations in open and closed boundaries.
4. Combustion & Gases: Ideal and real gas behavior, compressibility factors, combustion stoichiometry and enthalpy of formation.
`;
