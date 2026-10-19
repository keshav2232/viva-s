import { auth } from "@/services/firebase";

/**
 * fetch wrapper for /api/viva. Signed-in users send their Firebase ID token so the
 * server can give them the higher quota tier; guests simply send no token.
 */
export async function vivaFetch(init = {}) {
  const headers = { ...(init.headers || {}) };
  try {
    const user = auth && auth.currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } catch {
    /* token unavailable: continue as guest */
  }
  return fetch("/api/viva", { ...init, headers });
}
