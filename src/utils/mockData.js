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

export const ADAPTIVE_VIVAS = {
  "Thermodynamics": {
    intro: {
      text: "Can you state the second law of thermodynamics and explain its core physical significance?",
      speech: "Welcome. Let us begin your examination. Can you state the second law of thermodynamics and explain its core physical significance?"
    },
    branches: {
      advanced: {
        text: "Excellent. Let us move to a more advanced concept. How does the concept of entropy mathematically relate to the availability of work in a system, and what physical meaning does the Gouy-Stodola theorem convey?",
        speech: "Excellent. Let us move to a more advanced concept. How does the concept of entropy mathematically relate to the availability of work in a system, and what physical meaning does the Gouy-Stodola theorem convey?"
      },
      supportive: {
        text: "No worries, let us take it step-by-step. In simpler terms, if you place a hot cup of coffee in a cold room, what happens to the energy flow, and is it possible to reverse this process spontaneously?",
        speech: "No worries, let us take it step-by-step. In simpler terms, if you place a hot cup of coffee in a cold room, what happens to the energy flow, and is it possible to reverse this process spontaneously?"
      },
      foundational: {
        text: "Let us review some fundamental principles. Can you explain the basic physical differences between open, closed, and isolated systems, and provide a real-world example of each?",
        speech: "Let us review some fundamental principles. Can you explain the basic physical differences between open, closed, and isolated systems, and provide a real-world example of each?"
      },
      analytical: {
        text: "Good. Let's analyze the Carnot Cycle. Why can its thermal efficiency never reach 100% physically, and how does this validate the Kelvin-Planck statement?",
        speech: "Good. Let's analyze the Carnot Cycle. Why can its thermal efficiency never reach 100% physically, and how does this validate the Kelvin-Planck statement?"
      }
    },
    keywords: {
      "entropy": {
        text: "You mentioned entropy. Can you define it precisely in terms of microscopic disorder and state its relationship to the Clausius inequality?",
        speech: "You mentioned entropy. Can you define it precisely in terms of microscopic disorder and state its relationship to the Clausius inequality?"
      },
      "carnot": {
        text: "You referred to the Carnot cycle. Can you mathematically explain why it represents an absolute upper bound on thermal efficiency?",
        speech: "You referred to the Carnot cycle. Can you mathematically explain why it represents an absolute upper bound on thermal efficiency?"
      },
      "clausius": {
        text: "You touched upon the Clausius inequality. Can you write the cyclic integral equation for it and explain what happens when the integral equals zero?",
        speech: "You touched upon the Clausius inequality. Can you write the cyclic integral equation for it and explain what happens when the integral equals zero?"
      },
      "reversibility": {
        text: "You brought up reversibility. Physically speaking, what factors introduce irreversibility in a mechanical process, and how does friction impact entropy?",
        speech: "You brought up reversibility. Physically speaking, what factors introduce irreversibility in a mechanical process, and how does friction impact entropy?"
      }
    }
  },
  "Data Structures": {
    intro: {
      text: "Can you explain the differences between a Stack and a Queue in terms of their structural operations and time complexities?",
      speech: "Welcome. Let us begin your examination. Can you explain the differences between a Stack and a Queue in terms of their structural operations and time complexities?"
    },
    branches: {
      advanced: {
        text: "Excellent. Let us go a little deeper. Compare the worst-case search and insertion complexities of an AVL tree versus a Red-Black tree, and explain how self-balancing rotations prevent degradation.",
        speech: "Excellent. Let us go a little deeper. Compare the worst-case search and insertion complexities of an AVL tree versus a Red-Black tree, and explain how self-balancing rotations prevent degradation."
      },
      supportive: {
        text: "No worries, let us make it simple. If you are standing in a queue at a grocery store, does the first person in line get served first, and how does that differ from a stack of plates in a cafeteria?",
        speech: "No worries, let us make it simple. If you are standing in a queue at a grocery store, does the first person in line get served first, and how does that differ from a stack of plates in a cafeteria?"
      },
      foundational: {
        text: "Let us look at basic search mechanics. Can you explain the physical difference between a standard Binary Search Tree and a linear Linked List, particularly when searching for an element?",
        speech: "Let us look at basic search mechanics. Can you explain the physical difference between a standard Binary Search Tree and a linear Linked List, particularly when searching for an element?"
      },
      analytical: {
        text: "Good. Let's analyze hash tables. What is a hash collision, and how does separate chaining compare to open addressing in terms of space and search performance under high load factors?",
        speech: "Good. Let's analyze hash tables. What is a hash collision, and how does separate chaining compare to open addressing in terms of space and search performance under high load factors?"
      }
    },
    keywords: {
      "hash": {
        text: "You mentioned hash collisions. Can you explain how linear probing differs from quadratic probing, and how clustering affects search performance?",
        speech: "You mentioned hash collisions. Can you explain how linear probing differs from quadratic probing, and how clustering affects search performance?"
      },
      "tree": {
        text: "You referred to balanced trees. Can you walk me through the mathematical definition of a balance factor in AVL trees, and what triggers a left-right double rotation?",
        speech: "You referred to balanced trees. Can you walk me through the mathematical definition of a balance factor in AVL trees, and what triggers a left-right double rotation?"
      },
      "stack": {
        text: "You brought up stacks. How is a stack structure utilized by the system to manage recursive function activation frames, and what causes a stack overflow?",
        speech: "You brought up stacks. How is a stack structure utilized by the system to manage recursive function activation frames, and what causes a stack overflow?"
      },
      "bfs": {
        text: "You mentioned graph traversal. Under what circumstances would you choose Breadth-First Search over Depth-First Search, and what data structures support them?",
        speech: "You mentioned graph traversal. Under what circumstances would you choose Breadth-First Search over Depth-First Search, and what data structures support them?"
      }
    }
  },
  "Machine Design": {
    intro: {
      text: "What is the fundamental difference between static failure theories and fatigue failure theories when designing load-bearing components?",
      speech: "Welcome. Let us begin your examination. What is the fundamental difference between static failure theories and fatigue failure theories when designing load-bearing components?"
    },
    branches: {
      advanced: {
        text: "Excellent. Let's examine this in a more complex scenario. How do Soderberg, Goodman, and Gerber equations model mean and alternating stresses, and which of these is the most conservative for cyclic loading?",
        speech: "Excellent. Let's examine this in a more complex scenario. How do Soderberg, Goodman, and Gerber equations model mean and alternating stresses, and which of these is the most conservative for cyclic loading?"
      },
      supportive: {
        text: "No worries, let's break it down. If you bend a metal paperclip back and forth repeatedly until it snaps, what kind of failure are you demonstrating, and why does it fail even under very low force?",
        speech: "No worries, let's break it down. If you bend a metal paperclip back and forth repeatedly until it snaps, what kind of failure are you demonstrating, and why does it fail even under very low force?"
      },
      foundational: {
        text: "Let us review shaft design. What is stress concentration, and what physical modifications can you make to a shaft shoulder to mitigate concentration spikes?",
        speech: "Let us review shaft design. What is stress concentration, and what physical modifications can you make to a shaft shoulder to mitigate concentration spikes?"
      },
      analytical: {
        text: "Good. Let's analyze journal bearings. How does the dimensionless Sommerfeld Number influence hydrodynamic lubrication design, and what parameters does it combine?",
        speech: "Good. Let's analyze journal bearings. How does the dimensionless Sommerfeld Number influence hydrodynamic lubrication design, and what parameters does it combine?"
      }
    },
    keywords: {
      "goodman": {
        text: "You mentioned the Goodman boundary. Why does the Soderberg line utilize yield strength instead of ultimate tensile strength for mean stress, and why is this safer?",
        speech: "You mentioned the Goodman boundary. Why does the Soderberg line utilize yield strength instead of ultimate tensile strength for mean stress, and why is this safer?"
      },
      "concentration": {
        text: "You mentioned stress concentration. Explain the physical concept of stress flow lines and why geometric discontinuities cause localized stress spikes.",
        speech: "You mentioned stress concentration. Explain the physical concept of stress flow lines and why geometric discontinuities cause localized stress spikes."
      },
      "sommerfeld": {
        text: "You referred to bearing lubrication. Explain the difference between boundary lubrication, mixed lubrication, and hydrodynamic lubrication on a Stribeck curve.",
        speech: "You referred to bearing lubrication. Explain the difference between boundary lubrication, mixed lubrication, and hydrodynamic lubrication on a Stribeck curve."
      },
      "gears": {
        text: "You brought up spur gears. Explain the primary failure modes of gear teeth and how the Lewis equation models bending stress at the tooth root.",
        speech: "You brought up spur gears. Explain the primary failure modes of gear teeth and how the Lewis equation models bending stress at the tooth root."
      }
    }
  }
};

export const DUMMY_SYLLABUS = `
Course Code: ME-302
Subject: Advanced Applied Thermodynamics

Course Outcomes & Exam Coverage:
1. Laws of Thermodynamics: First law energy balance, Second law limitations, entropy generation, exergy analysis, Clausius inequality.
2. Thermodynamic Cycles: Carnot cycle limitations, Rankine vapor cycle, reheating and regeneration, Brayton gas turbine cycle.
3. Bearings & Fluid Cycles: Phase diagrams, Clapeyron phase boundaries, Maxwell relations, enthalpy transformations in open and closed boundaries.
4. Combustion & Gases: Ideal and real gas behavior, compressibility factors, combustion stoichiometry and enthalpy of formation.
`;
