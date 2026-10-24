// Shared constants for the library bot. Labels live in data/taxonomy.json.

export const CRITERIA_KEYS = [
  "art_direction",
  "three_d_usage",
  "character_design",
  "animation",
  "mood",
  "pacing",
  "narrative_complexity",
  "emotional_intensity",
  "sexualization",
];

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;

export const CONFIDENCE_WEIGHT = { certain: 1, mitigated: 0.5 };

// Sum of weights needed for confidence = 1 (3 "certain" reviews).
export const CONFIDENCE_FULL_WEIGHT = 3;

export const MOOD_TAGS_MAX = 4;
export const MOOD_TAG_MIN_PART = 0.4;

export const CONTRIBUTIONS_MAX = 20;
