// Turns raw reviews into anime.json entries. Pure functions: no network, no files.

import {
  CRITERIA_KEYS,
  CONFIDENCE_WEIGHT,
  CONFIDENCE_FULL_WEIGHT,
  LEVEL_MIN,
  LEVEL_MAX,
  MOOD_TAG_MIN_PART,
} from "./criteria.mjs";

const round = (x, decimals) => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

/**
 * Weighted median: first level where the cumulative weight reaches half the total.
 * Exactly half → average with the next level.
 * @param {{ level: number, weight: number }[]} items
 * @returns {number | null} null when empty (never 0)
 */
export function weightedMedian(items) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.level - b.level);
  const half = sorted.reduce((sum, it) => sum + it.weight, 0) / 2;
  let cumul = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumul += sorted[i].weight;
    if (cumul === half) return (sorted[i].level + sorted[i + 1].level) / 2;
    if (cumul > half) return sorted[i].level;
  }
  return null;
}

/**
 * Combined value per criterion.
 * @returns {Record<string, { value: number|null, value01: number|null, votes: number, confidence: number }>}
 */
export function aggregateRatings(reviews) {
  const ratings = {};
  for (const key of CRITERIA_KEYS) {
    const items = [];
    for (const review of reviews) {
      const r = review.ratings?.[key];
      if (r) items.push({ level: r.level, weight: CONFIDENCE_WEIGHT[r.confidence] });
    }
    const median = weightedMedian(items);
    if (median === null) {
      ratings[key] = { value: null, value01: null, votes: 0, confidence: 0 };
      continue;
    }
    const totalWeight = items.reduce((sum, it) => sum + it.weight, 0);
    ratings[key] = {
      value: round(median, 1),
      value01: round((median - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN), 2),
      votes: items.length,
      confidence: round(Math.min(1, totalWeight / CONFIDENCE_FULL_WEIGHT), 2),
    };
  }
  return ratings;
}

/**
 * Kept mood tags: part = reviews ticking the tag / all reviews of the anime.
 * Kept when part >= MOOD_TAG_MIN_PART. Sorted by part desc, then id.
 */
export function aggregateMoodTags(reviews) {
  if (reviews.length === 0) return [];
  const counts = new Map();
  for (const review of reviews) {
    for (const tag of new Set(review.mood_tags ?? [])) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, part: count / reviews.length }))
    .filter((t) => t.part >= MOOD_TAG_MIN_PART)
    .sort((a, b) => b.part - a.part || a.id.localeCompare(b.id))
    .map((t) => ({ id: t.id, part: round(t.part, 2) }));
}

/** Adds a review; replaces the same author's previous one. Does not mutate. */
export function upsertReview(reviews, review) {
  return [...reviews.filter((r) => r.author !== review.author), review];
}

/**
 * Builds data/anime.json: catalogue entries + aggregated reviews.
 * @param {object[]} catalogue entries of data/catalogue.json
 * @param {Record<string, object[]>} reviewsById reviews keyed by anilist_id (string)
 */
export function buildAnimeJson(catalogue, reviewsById) {
  return [...catalogue]
    .sort((a, b) => a.anilist_id - b.anilist_id)
    .map((entry) => {
      const reviews = reviewsById[String(entry.anilist_id)] ?? [];
      return {
        ...entry,
        ratings: aggregateRatings(reviews),
        mood_tags: aggregateMoodTags(reviews),
      };
    });
}
