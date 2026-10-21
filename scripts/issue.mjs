// Reads and validates the JSON block of a suggestion issue. Pure functions.

import {
  CRITERIA_KEYS,
  CONFIDENCE_WEIGHT,
  LEVEL_MIN,
  LEVEL_MAX,
  MOOD_TAGS_MAX,
  CONTRIBUTIONS_MAX,
} from "./criteria.mjs";

export const MARKER = "<!-- animeselect:library-suggestion -->";
export const SCHEMA_VERSION = 1;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isLevel = (v) => Number.isInteger(v) && v >= LEVEL_MIN && v <= LEVEL_MAX;
// Inline code for comments; user text never breaks out of the backticks.
export const code = (v) => "`" + String(v).replace(/`/g, "'").replace(/\s+/g, " ").slice(0, 60) + "`";

/** The bot trusts the marker, never the title. */
export const hasMarker = (body) => typeof body === "string" && body.trimStart().startsWith(MARKER);

/** First fenced block (```json or ```), parsed. */
export function extractJson(body) {
  const m = /```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n[^\S\r\n]*```/.exec(body);
  if (!m) return { error: "No ```json block found in the issue." };
  try {
    return { data: JSON.parse(m[1]) };
  } catch (e) {
    return { error: `The JSON block is not valid JSON (${e.message}).` };
  }
}

function unknownKeys(obj, allowed, where, errors) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${where}: unknown field ${code(k)}.`);
}

/**
 * @param {unknown} data parsed JSON block
 * @param {Set<string>} moodIds ids of taxonomy.json > moodTags
 * @returns {{ errors: string[], contributions: { anilist_id: number, ratings: object, mood_tags: string[] }[] }}
 */
export function validateSubmission(data, moodIds) {
  const errors = [];
  if (!isObject(data)) return { errors: ["The JSON block must be an object."], contributions: [] };
  if (data.schema !== SCHEMA_VERSION) errors.push(`\`schema\` must be ${SCHEMA_VERSION}.`);
  unknownKeys(data, ["schema", "contributions"], "JSON block", errors);

  const list = data.contributions;
  if (!Array.isArray(list) || list.length === 0 || list.length > CONTRIBUTIONS_MAX) {
    errors.push(`\`contributions\` must be a list of 1 to ${CONTRIBUTIONS_MAX} items.`);
    return { errors, contributions: [] };
  }

  const seen = new Set();
  list.forEach((c, i) => {
    let where = `Contribution ${i + 1}`;
    if (!isObject(c)) return errors.push(`${where}: must be an object.`);

    const id = c.anilist_id;
    if (!(Number.isInteger(id) && id > 0)) errors.push(`${where}: \`anilist_id\` must be a positive integer.`);
    else {
      where += ` (AniList ${id})`;
      if (seen.has(id)) errors.push(`${where}: this anime appears more than once.`);
      seen.add(id);
    }
    unknownKeys(c, ["anilist_id", "ratings", "mood_tags"], where, errors);

    const ratings = c.ratings ?? {};
    if (!isObject(ratings)) errors.push(`${where}: \`ratings\` must be an object.`);
    else {
      for (const [key, r] of Object.entries(ratings)) {
        if (!CRITERIA_KEYS.includes(key)) {
          errors.push(`${where}: unknown criterion ${code(key)}.`);
          continue;
        }
        if (!isObject(r)) {
          errors.push(`${where}, ${key}: must be an object with \`level\` and \`confidence\`.`);
          continue;
        }
        if (!isLevel(r.level)) errors.push(`${where}, ${key}: \`level\` must be an integer from ${LEVEL_MIN} to ${LEVEL_MAX}.`);
        if (!Object.hasOwn(CONFIDENCE_WEIGHT, r.confidence)) {
          errors.push(`${where}, ${key}: \`confidence\` must be ${Object.keys(CONFIDENCE_WEIGHT).map(code).join(" or ")}.`);
        }
        unknownKeys(r, ["level", "confidence"], `${where}, ${key}`, errors);
      }
    }

    const moods = c.mood_tags ?? [];
    if (!Array.isArray(moods)) errors.push(`${where}: \`mood_tags\` must be a list.`);
    else {
      if (moods.length > MOOD_TAGS_MAX) errors.push(`${where}: at most ${MOOD_TAGS_MAX} moods.`);
      if (new Set(moods).size !== moods.length) errors.push(`${where}: a mood is listed twice.`);
      for (const m of moods) if (!moodIds.has(m)) errors.push(`${where}: unknown mood ${code(m)}.`);
    }

    if (isObject(ratings) && Object.keys(ratings).length === 0 && Array.isArray(moods) && moods.length === 0) {
      errors.push(`${where}: nothing to record (no criterion and no mood).`);
    }
  });

  if (errors.length) return { errors, contributions: [] };
  return {
    errors,
    contributions: list.map((c) => ({ anilist_id: c.anilist_id, ratings: c.ratings ?? {}, mood_tags: c.mood_tags ?? [] })),
  };
}
