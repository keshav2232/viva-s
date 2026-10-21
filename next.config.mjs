const isDev = process.env.NODE_ENV === "development";

// Content Security Policy: only the origins the browser actually talks to are allowed.
// Gemini and ElevenLabs are called from our server, never from the browser, so they are not listed.
// 'unsafe-inline' scripts are needed because Next.js inlines its bootstrap scripts (no nonce setup);
// 'unsafe-eval' is only needed by React's dev tooling.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  // Firebase Auth, Firestore and token refresh; ws: only for the dev server's hot reload.
  `connect-src 'self' https://*.googleapis.com https://apis.google.com${isDev ? " ws: wss:" : ""}`,
  // Google sign-in pop-up / redirect helper pages.
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is used only by this site itself; nothing else is allowed.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
  // Lets the Google sign-in pop-up report back to this window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Only has an effect over HTTPS; tells browsers to always use HTTPS for this site.
  { key: "Strict-Transport-Security", value: "max-age=31536000" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.7', '192.168.1.11', 'localhost:3000'],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
