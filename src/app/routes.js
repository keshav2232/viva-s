/**
 * Address map for the practice app. One catch-all page (app/[[...slug]]/page.js) serves all of
 * these; the server uses this table for titles and 404s, the browser uses it to pick the screen.
 * Separate pages (privacy, terms, contact, voice-lab, api) are normal Next.js routes and win
 * over the catch-all.
 */

export const ROUTES = {
  landing: { path: "/", title: "PrepSim — Practice for the moments that matter", private: false },
  login: { path: "/login", title: "Sign in — PrepSim", private: false },
  signup: { path: "/signup", title: "Create your account — PrepSim", private: false },
  dashboard: { path: "/dashboard", title: "Dashboard — PrepSim", private: true },
  setup: { path: "/practice/new", title: "New practice session — PrepSim", private: true },
  viva: { path: "/practice/session", title: "Practice in progress — PrepSim", private: true },
  report: { path: "/reports/:id", title: "Session report — PrepSim", private: true }
};

/** Match path segments (["reports", "abc"]) or a pathname ("/reports/abc") to a route, or null. */
export function matchRoute(input) {
  const parts = Array.isArray(input)
    ? input
    : String(input || "/").split("?")[0].split("#")[0].split("/").filter(Boolean);
  const path = `/${parts.map((p) => decodeURIComponent(p)).join("/")}`;
  for (const [name, route] of Object.entries(ROUTES)) {
    if (route.path === path) return { name, params: {} };
  }
  if (parts.length === 2 && parts[0] === "reports" && parts[1]) {
    return { name: "report", params: { id: decodeURIComponent(parts[1]) } };
  }
  return null;
}

/** Build the address for a route name. */
export function pathFor(name, params = {}) {
  if (name === "report") return `/reports/${encodeURIComponent(params.id || "")}`;
  return ROUTES[name]?.path || "/";
}

export function titleFor(name) {
  return ROUTES[name]?.title || ROUTES.landing.title;
}
