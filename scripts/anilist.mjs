// AniList access and conversion to catalogue entries. Only fetchMedia touches the network.

export const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english }
      synonyms
      description(asHtml: false)
      coverImage { large }
      seasonYear
      startDate { year }
      format
      episodes
      status
      genres
      tags { name rank isMediaSpoiler }
      relations { edges { relationType node { id type } } }
    }
  }
}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(variables, fetchImpl, attempt = 0) {
  const res = await fetchImpl(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (res.status === 429 && attempt < 3) {
    await sleep((Number(res.headers.get("retry-after")) || 60) * 1000);
    return post(variables, fetchImpl, attempt + 1);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    const detail = json?.errors?.map((e) => e.message).join("; ") ?? "no JSON";
    throw new Error(`AniList request failed (${res.status}): ${detail}`);
  }
  return json;
}

/**
 * @param {number[]} ids
 * @returns {Promise<Map<number, object>>} raw AniList media by id; unknown ids are absent
 */
export async function fetchMedia(ids, { fetchImpl = fetch, perPage = 50 } = {}) {
  const unique = [...new Set(ids)];
  const out = new Map();
  for (let i = 0; i < unique.length; i += perPage) {
    const json = await post({ ids: unique.slice(i, i + perPage), perPage }, fetchImpl);
    for (const m of json.data.Page.media) out.set(m.id, m);
  }
  return out;
}

/** AniList id of an anime prequel, or null. One work = its first season. */
export function prequelOf(media) {
  const edge = (media.relations?.edges ?? []).find((e) => e.relationType === "PREQUEL" && e.node?.type === "ANIME");
  return edge ? edge.node.id : null;
}

export const titleOf = (media) => media.title?.english || media.title?.romaji || `AniList ${media.id}`;

const FORMATS = { TV: "TV", TV_SHORT: "TV", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA" };
const STATUSES = { FINISHED: "finished", RELEASING: "airing" };

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#039": "'", apos: "'", nbsp: " " };

export function cleanSynopsis(text) {
  if (!text) return null;
  const clean = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#039|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return clean || null;
}

const sortedUnique = (list) => [...new Set(list)].sort();

/**
 * @param {object} media raw AniList media
 * @param {{ minTagRank: number, genres: object, demographics: object, themes: object }} mapping data/anilist-mapping.json
 */
export function toCatalogueEntry(media, mapping) {
  const title = titleOf(media);
  const alternates = [media.title?.romaji, media.title?.english, ...(media.synonyms ?? [])].filter((t) => t && t !== title);
  const tags = (media.tags ?? []).filter((t) => !t.isMediaSpoiler && t.rank >= mapping.minTagRank).map((t) => t.name);
  const pick = (names, table) => sortedUnique(names.map((n) => table[n]).filter(Boolean));
  return {
    anilist_id: media.id,
    title,
    alternate_titles: [...new Set(alternates)],
    synopsis: cleanSynopsis(media.description),
    image_url: media.coverImage?.large ?? null,
    year: media.seasonYear ?? media.startDate?.year ?? null,
    format: FORMATS[media.format] ?? null,
    episode_count: media.episodes ?? null,
    status: STATUSES[media.status] ?? "unknown",
    genres: pick([...(media.genres ?? []), ...tags], mapping.genres),
    demographics: pick(tags, mapping.demographics),
    themes: pick(tags, mapping.themes),
  };
}
