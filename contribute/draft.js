// Draft saved in the browser. Invalid drafts are dropped entirely.
import { CRITERIA, CRITERIA_LEVELS, MOODS, MAX_MOODS } from "./schema.js";
import { safeUrl } from "./anilist.js";
import { MAX_ITEMS } from "./config.js";

export const DRAFT_KEY = "as-draft-v1";

function anime(a) {
  if (!a || !Number.isSafeInteger(a.id) || a.id <= 0 || typeof a.title !== "string" || !a.title.trim()) return null;
  return {
    id: a.id,
    title: a.title.slice(0, 300),
    romaji: typeof a.romaji === "string" ? a.romaji.slice(0, 300) : "",
    year: Number.isInteger(a.year) ? a.year : null,
    format: typeof a.format === "string" && /^[A-Z_]{1,20}$/.test(a.format) ? a.format : "",
    cover: safeUrl(a.cover),
  };
}
function ratings(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (!CRITERIA.includes(k) || !CRITERIA_LEVELS.includes(v?.l) || !["c", "m"].includes(v?.c)) return null;
    out[k] = { l: v.l, c: v.c };
  }
  return out;
}
function moods(m) {
  if (!Array.isArray(m) || m.length > MAX_MOODS || !m.every((id) => MOODS.includes(id)) || new Set(m).size !== m.length) return null;
  return [...m];
}

// Returns { sel, R, M, Q } or null.
export function parseDraft(raw) {
  if (!raw) return null;
  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  if (d?.v !== 1 || !Array.isArray(d.Q) || d.Q.length > MAX_ITEMS) return null;
  const sel = d.sel === null ? null : anime(d.sel);
  const R = ratings(d.R ?? {}), M = moods(d.M ?? []);
  if ((d.sel !== null && !sel) || !R || !M) return null;
  const Q = [];
  for (const x of d.Q) {
    const a = anime(x?.a), r = ratings(x?.r), m = moods(x?.m);
    if (!a || !r || !m || !Object.keys(r).length || Q.some((y) => y.a.id === a.id)) return null;
    Q.push({ a, r, m });
  }
  return { sel, R: sel ? R : {}, M: sel ? M : [], Q };
}

export function serializeDraft({ sel, R, M, Q }) {
  return JSON.stringify({ v: 1, sel, R, M, Q });
}

export const isEmptyDraft = ({ sel, Q }) => !sel && !Q.length;
