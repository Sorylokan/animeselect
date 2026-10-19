// Builds the GitHub issue read by the library bot.
import { GITHUB_REPO, ISSUE_PREFIX } from "./config.js";
import { CRITERIA, CONFIDENCE } from "./schema.js";

export { CRITERIA };

// GitHub rejects URLs around 8,000 characters.
export const MAX_URL_LENGTH = 7000;

// Hidden marker: the bot looks for this, not the title.
export const MARKER = "<!-- animeselect:library-suggestion -->";
const INTRO = `${MARKER}\nReview sent from the AnimeSelect annotation page. Do not edit the block below: it is read automatically.`;

// entry: { a: anime, r: { key: { l: 1-5, c: "c" | "m" } }, m: moods }
export function toPayload(entries) {
  return {
    schema: 1,
    contributions: entries.map(({ a, r, m }) => ({
      anilist_id: a.id,
      ratings: Object.fromEntries(CRITERIA.filter((k) => r[k]).map((k) => [k, { level: r[k].l, confidence: CONFIDENCE[r[k].c] }])),
      mood_tags: [...m],
    })),
  };
}

const clean = (text) => String(text).replace(/\s+/g, " ").trim();

export function issueTitle(entries) {
  if (entries.length === 1) return `${ISSUE_PREFIX} ${clean(entries[0].a.title)} (AniList ${entries[0].a.id})`;
  return `${ISSUE_PREFIX} ${entries.length} anime (AniList ${entries.map((e) => e.a.id).join(", ")})`;
}

export function issueBody(payload, { compact = false } = {}) {
  return `${INTRO}\n\n\`\`\`json\n${JSON.stringify(payload, null, compact ? 0 : 2)}\n\`\`\`\n`;
}

export function issueUrl(title, body, repo = GITHUB_REPO) {
  const params = new URLSearchParams(body === undefined ? { title } : { title, body });
  return `https://github.com/${repo}/issues/new?${params}`;
}

// Prefilled link if it fits; otherwise title-only link and the body is pasted.
export function prepareIssue(entries, repo = GITHUB_REPO) {
  const payload = toPayload(entries), title = issueTitle(entries);
  for (const compact of [false, true]) {
    const body = issueBody(payload, { compact });
    const url = issueUrl(title, body, repo);
    if (url.length <= MAX_URL_LENGTH) return { url, body, prefilled: true };
  }
  return { url: issueUrl(title, undefined, repo), body: issueBody(payload), prefilled: false };
}

export const repoConfigured = (repo = GITHUB_REPO) => /^[\w.-]+\/[\w.-]+$/.test(repo) && repo !== "OWNER/REPO";
