// Rebuilds data/catalogue.json (identity from AniList) and data/anime.json (cards).
//   node scripts/build.mjs            fetch only anime missing from the catalogue
//   node scripts/build.mjs --refresh  refetch every anime (applies mapping changes)
//   node scripts/build.mjs --offline  no network: uses the catalogue as it is

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMedia, toCatalogueEntry } from "./anilist.mjs";
import { buildAnimeJson } from "./aggregate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = (name) => resolve(root, "data", name);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

const refresh = process.argv.includes("--refresh");
const offline = process.argv.includes("--offline");

const mapping = readJson(data("anilist-mapping.json"));
const catalogue = new Map((existsSync(data("catalogue.json")) ? readJson(data("catalogue.json")) : []).map((e) => [e.anilist_id, e]));

const reviewsById = {};
if (existsSync(data("avis"))) {
  for (const file of readdirSync(data("avis"))) {
    const m = /^(\d+)\.json$/.exec(file);
    if (m) reviewsById[m[1]] = readJson(data(`avis/${file}`));
  }
}
const reviewedIds = Object.keys(reviewsById).map(Number);
const wanted = [...new Set([...reviewedIds, ...catalogue.keys()])];
const toFetch = offline ? [] : wanted.filter((id) => refresh || !catalogue.has(id));

if (toFetch.length) {
  try {
    const media = await fetchMedia(toFetch);
    for (const id of toFetch) {
      if (media.has(id)) catalogue.set(id, toCatalogueEntry(media.get(id), mapping));
      else console.warn(`AniList ${id}: not found, kept as it was.`);
    }
  } catch (e) {
    // Refresh failures keep the old entries; only missing ones are a real problem.
    console.warn(`AniList unavailable: ${e.message}`);
  }
}

const missing = reviewedIds.filter((id) => !catalogue.has(id));
for (const id of missing) console.warn(`AniList ${id}: reviewed but not in the catalogue, left out of anime.json.`);

const entries = [...catalogue.values()].sort((a, b) => a.anilist_id - b.anilist_id);
writeJson(data("catalogue.json"), entries);
writeJson(data("anime.json"), buildAnimeJson(entries, reviewsById));
console.log(`anime.json: ${entries.length} anime, ${reviewedIds.length} with reviews.`);
if (missing.length && !offline) process.exitCode = 1;
