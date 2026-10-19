/** Tiny TTL cache with in-flight de-duplication, used for repeatable AI requests. */
const store = new Map(); // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise
const MAX_ENTRIES = 200;

export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const value = await producer();
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/** Small stable string hash for cache keys (not security sensitive). */
export function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
