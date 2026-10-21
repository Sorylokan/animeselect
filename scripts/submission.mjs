// From an issue to new review files. No file or network access: both are injected.

import { hasMarker, extractJson, validateSubmission, code } from "./issue.mjs";
import { prequelOf, titleOf } from "./anilist.mjs";
import { upsertReview } from "./aggregate.mjs";

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ");

/**
 * @param {object} p
 * @param {string} p.body issue body
 * @param {string} p.author GitHub login of the issue author
 * @param {number} p.issueNumber
 * @param {string} p.submittedAt ISO date
 * @param {Set<string>} p.moodIds
 * @param {(id: number) => object[]} p.loadReviews current reviews of an anime
 * @param {(ids: number[]) => Promise<Map<number, object>>} p.fetchMedia
 * @returns {Promise<{ status: "ignored" } | { status: "invalid", errors: string[] }
 *   | { status: "ok", files: { anilist_id: number, reviews: object[] }[], summary: object[] }>}
 */
export async function processSubmission({ body, author, issueNumber, submittedAt, moodIds, loadReviews, fetchMedia }) {
  if (!hasMarker(body)) return { status: "ignored" };

  const parsed = extractJson(body);
  if (parsed.error) return { status: "invalid", errors: [parsed.error] };
  const { errors, contributions } = validateSubmission(parsed.data, moodIds);
  if (errors.length) return { status: "invalid", errors };

  let media;
  try {
    media = await fetchMedia(contributions.map((c) => c.anilist_id));
  } catch (e) {
    return { status: "invalid", errors: [`AniList could not be reached, nothing was saved. Edit this issue later to try again. (${e.message})`] };
  }

  const aniErrors = [];
  for (const { anilist_id: id } of contributions) {
    const m = media.get(id);
    if (!m) aniErrors.push(`AniList ${id}: not found on AniList, or not an anime.`);
    else {
      const prequel = prequelOf(m);
      if (prequel) {
        aniErrors.push(`AniList ${id} (${code(titleOf(m))}) is a sequel. Rate the whole work on its first season instead (its prequel is https://anilist.co/anime/${prequel}).`);
      }
    }
  }
  if (aniErrors.length) return { status: "invalid", errors: aniErrors };

  const files = contributions.map((c) => {
    const review = { author, issue: issueNumber, submitted_at: submittedAt, ratings: c.ratings, mood_tags: c.mood_tags };
    const reviews = upsertReview(loadReviews(c.anilist_id), review).sort((a, b) => a.author.localeCompare(b.author));
    return { anilist_id: c.anilist_id, reviews };
  });
  const summary = contributions.map((c) => ({
    anilist_id: c.anilist_id,
    title: titleOf(media.get(c.anilist_id)),
    criteria: Object.keys(c.ratings).length,
    mood_tags: c.mood_tags,
  }));
  return { status: "ok", files, summary };
}

export function invalidComment(errors) {
  return [
    "Thanks for the suggestion! The library bot could not record it:",
    "",
    ...errors.map((e) => `- ${e}`),
    "",
    "Nothing was saved. Edit this issue to fix it (keep the JSON block as it is otherwise): the bot will check it again.",
  ].join("\n");
}

export function pullRequestBody({ author, issueNumber, summary }) {
  return [
    `Suggestion from @${author} in #${issueNumber}.`,
    "",
    "| Anime | Criteria | Moods |",
    "|---|---|---|",
    ...summary.map((s) => `| [${cell(s.title)}](https://anilist.co/anime/${s.anilist_id}) | ${s.criteria} | ${s.mood_tags.join(", ") || "–"} |`),
    "",
    "Merging adds these reviews to the library. `data/anime.json` is rebuilt automatically after the merge.",
    "",
    `Closes #${issueNumber}`,
  ].join("\n");
}
