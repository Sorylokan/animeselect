// Local import of a big batch of reviews (e.g. the base library), without GitHub issues.
// Same checks and same files as the issue bot, split into batches of 20.
//   node scripts/import-local.mjs <avis.json> [--author Sorylokan] [--dry-run]
// <avis.json> = { "schema": 1, "contributions": [...] }, as exported by the annotator.
// Writes nothing unless every contribution is valid, then rebuilds data/anime.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { MARKER } from "./issue.mjs";
import { processSubmission } from "./submission.mjs";
import { fetchMedia as realFetchMedia } from "./anilist.mjs";
import { CONTRIBUTIONS_MAX } from "./criteria.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const avisDir = resolve(root, "data/avis");
const avisPath = (id) => resolve(avisDir, `${id}.json`);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/**
 * Validates every batch first; returns all files only if nothing failed.
 * @returns {Promise<{ errors: string[], files: { anilist_id: number, reviews: object[] }[] }>}
 */
export async function importAll({ data, author, submittedAt, moodIds, loadReviews, fetchMedia }) {
  const list = data?.contributions;
  if (!Array.isArray(list) || !list.length) return { errors: ["`contributions` must be a non-empty list."], files: [] };

  // Batches cannot see each other, so duplicates are checked here.
  const count = new Map();
  for (const c of list) count.set(c?.anilist_id, (count.get(c?.anilist_id) ?? 0) + 1);
  const dupes = [...count].filter(([, n]) => n > 1).map(([id]) => `AniList ${id}: appears more than once.`);
  if (dupes.length) return { errors: dupes, files: [] };

  const errors = [];
  const files = [];
  for (let i = 0; i < list.length; i += CONTRIBUTIONS_MAX) {
    const chunk = { schema: data.schema, contributions: list.slice(i, i + CONTRIBUTIONS_MAX) };
    const body = `${MARKER}\n\n\`\`\`json\n${JSON.stringify(chunk)}\n\`\`\`\n`;
    const res = await processSubmission({ body, author, issueNumber: null, submittedAt, moodIds, loadReviews, fetchMedia });
    // Renumber "Contribution n" to its position in the whole file.
    if (res.status === "invalid") errors.push(...res.errors.map((e) => e.replace(/^Contribution (\d+)/, (_, n) => `Contribution ${i + Number(n)}`)));
    else files.push(...res.files);
  }
  return errors.length ? { errors, files: [] } : { errors, files };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--author");
  const author = args.includes("--author") ? args[args.indexOf("--author") + 1] : "Sorylokan";
  const dryRun = args.includes("--dry-run");
  if (!file || !author) {
    console.error("Usage: node scripts/import-local.mjs <avis.json> [--author Sorylokan] [--dry-run]");
    process.exit(2);
  }

  let data;
  try { data = readJson(resolve(file)); } catch (e) { console.error(`Cannot read ${file}: ${e.message}`); process.exit(1); }

  const taxonomy = readJson(resolve(root, "data/taxonomy.json"));
  const { errors, files } = await importAll({
    data,
    author,
    submittedAt: new Date().toISOString(),
    moodIds: new Set(taxonomy.moodTags.map((m) => m.id)),
    loadReviews: (id) => (existsSync(avisPath(id)) ? readJson(avisPath(id)) : []),
    fetchMedia: (ids) => realFetchMedia(ids),
  });

  if (errors.length) {
    console.error(`Nothing written. ${errors.length} problem(s):`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  if (dryRun) {
    console.log(`Dry run OK: ${files.length} anime would be written to data/avis/.`);
    return;
  }

  mkdirSync(avisDir, { recursive: true });
  for (const f of files) writeFileSync(avisPath(f.anilist_id), JSON.stringify(f.reviews, null, 2) + "\n");
  console.log(`${files.length} files written to data/avis/ (author: ${author}). Rebuilding the library…`);
  execFileSync(process.execPath, [resolve(root, "scripts/build.mjs")], { stdio: "inherit" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
