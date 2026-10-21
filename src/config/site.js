/**
 * Public site details used by the legal and contact pages. Set these in .env.local / your host's
 * environment settings; nothing here is a secret (NEXT_PUBLIC_ values are visible in the browser).
 */
export const SITE = {
  name: "PrepSim",
  // Who runs the service (a person or a registered business). Shown in the privacy policy and terms.
  operator: process.env.NEXT_PUBLIC_LEGAL_OPERATOR || "",
  // Where users can reach you about support, privacy requests and deletion.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  // Country / state whose law governs the terms, e.g. "India" or "England and Wales".
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "",
  // Set to "true" once the Gemini API key is on a paid (billing-enabled) plan. On the free tier Google
  // may use submitted content to improve its products, and the privacy policy must say so.
  geminiPaidTier: process.env.NEXT_PUBLIC_GEMINI_PAID_TIER === "true",
  // Hosting provider named in the privacy policy, e.g. "Vercel".
  host: process.env.NEXT_PUBLIC_HOSTING_PROVIDER || "",
  // Minimum age to use the service without a parent or guardian.
  minimumAge: 13,
  // Date the policy text below was last changed.
  policyUpdated: "21 October 2026"
};

/** The people behind the site, shown on the contact page. */
export const FOUNDERS = [
  {
    name: "Rishabh Mishra",
    initials: "RM",
    email: "mishra.r0805@gmail.com",
    linkedin: "https://www.linkedin.com/in/rishabh-mishra-61b211338/"
  },
  {
    name: "Keshav Agarwal",
    initials: "KA",
    email: "keshavagarwal2908@gmail.com",
    linkedin: "https://www.linkedin.com/in/keshav-agarwal-537612381"
  }
];

/** True when the details a production site must publish have been filled in. */
export const isLegalConfigured = () => Boolean(SITE.operator && SITE.supportEmail && SITE.jurisdiction);
