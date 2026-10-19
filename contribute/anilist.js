// AniList search (public API, no key needed).
const ENDPOINT = "https://graphql.anilist.co";
const CACHE_DURATION = 10 * 60 * 1000;
const MIN_SPACING = 700;
const cache = new Map();
let lastSentAt = 0;
let blockedUntil = 0;

export class ApiError extends Error {
  constructor(code, status = 0, seconds = null) {
    super(code);
    this.name = "ApiError";
    this.code = code; // search.error.<code>; "aborted" is ignored
    this.status = status;
    this.seconds = seconds; // null = unknown
  }
}

// Tests only.
export function resetLimits() { lastSentAt = 0; blockedUntil = 0; cache.clear(); }

const aborted = () => new ApiError("aborted");

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    function stop() { clearTimeout(timer); reject(aborted()); }
    signal?.addEventListener("abort", stop, { once: true });
  });
}

// Retry-After is often hidden by CORS: return null rather than guess.
function retrySeconds(response) {
  const value = response.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value), date = Date.parse(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return null;
}

async function send(query, variables, fetcher, signal) {
  if (Date.now() < blockedUntil) throw new ApiError("limit", 429, null);
  // Rate limit: space out requests actually sent.
  while (Date.now() < lastSentAt + MIN_SPACING) await wait(lastSentAt + MIN_SPACING - Date.now(), signal);
  if (signal?.aborted) throw aborted();
  lastSentAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward, { once: true });
  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (response.status === 429) {
      const seconds = retrySeconds(response);
      blockedUntil = Date.now() + (seconds ?? 60) * 1000;
      throw new ApiError("limit", 429, seconds);
    }
    if (!response.ok) throw new ApiError("http", response.status);
    const payload = await response.json();
    if (payload.errors?.length || !payload.data) throw new ApiError("http", payload.errors?.[0]?.status || 0);
    return payload.data;
  } catch (error) {
    if (signal?.aborted) throw aborted();
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forward);
  }
}

export async function request(query, variables = {}, { fetcher = globalThis.fetch, signal } = {}) {
  const key = JSON.stringify([query, variables]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await send(query, variables, fetcher, signal);
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { data, expires: Date.now() + CACHE_DURATION });
  return data;
}

const MEDIA_FIELDS = "id type isAdult title { english romaji native } coverImage { large } seasonYear startDate { year } format";
const SEARCH_QUERY = `query ($search: String) {
  Page(page: 1, perPage: 25) {
    media(type: ANIME, isAdult: false, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      ${MEDIA_FIELDS}
      relations { edges { relationType node { ${MEDIA_FIELDS} } } }
    }
  }
}`;

export function cleanSearch(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// https only.
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function toAnime(media) {
  return {
    id: media.id,
    title: media.title?.english || media.title?.romaji || media.title?.native || `AniList #${media.id}`,
    romaji: media.title?.romaji || "",
    year: media.seasonYear || media.startDate?.year || null,
    format: media.format || "",
    cover: safeUrl(media.coverImage?.large),
  };
}

// One anime = its first season: sequels (PREQUEL links) are folded into it.
// Remakes and side stories stay separate.
export function groupSeasons(mediaList) {
  const known = new Map(), prequelOf = new Map();
  const usable = (m) => m && m.type !== "MANGA" && m.isAdult !== true && Number.isSafeInteger(m.id);
  for (const m of mediaList) {
    if (!usable(m)) continue;
    if (!known.has(m.id)) known.set(m.id, m);
    for (const edge of m.relations?.edges ?? []) {
      if (!usable(edge?.node) || edge.node.type !== "ANIME") continue;
      if (!known.has(edge.node.id)) known.set(edge.node.id, edge.node);
      if (edge.relationType === "PREQUEL" && !prequelOf.has(m.id)) prequelOf.set(m.id, edge.node.id);
    }
  }
  const rootOf = (id) => {
    const seen = new Set([id]);
    while (prequelOf.has(id)) {
      const next = prequelOf.get(id);
      if (seen.has(next)) return Math.min(...seen); // loop in AniList data
      id = next; seen.add(id);
    }
    return id;
  };
  const groups = new Map();
  for (const m of mediaList) {
    if (!usable(m)) continue;
    const root = rootOf(m.id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(m.id);
  }
  return [...groups].map(([root, ids]) => ({ ...toAnime(known.get(root)), sequels: [...ids].filter((id) => id !== root).length }));
}

export async function searchAnime(text, options) {
  const search = cleanSearch(text);
  if (search.length < 2) return [];
  const data = await request(SEARCH_QUERY, { search }, options);
  return groupSeasons(data.Page?.media || []);
}
