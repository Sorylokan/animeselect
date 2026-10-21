// Review structure. Must match the bot (see tests/consistency.test.js).
export const CRITERIA_LEVELS = [1, 2, 3, 4, 5];
export const SECTIONS = [
  ["visual", ["art_direction", "three_d_usage", "character_design", "animation"]],
  ["story", ["mood", "pacing", "narrative_complexity", "emotional_intensity"]],
  ["other", ["fan_service"]],
];
export const CRITERIA = SECTIONS.flatMap(([, keys]) => keys);
export const MOODS = ["absurd", "bittersweet", "brutal", "cerebral", "chaotic", "cheerful", "contemplative", "cozy", "dark", "dreamy", "energetic", "epic", "gritty", "hopeful", "intense", "melancholic", "mysterious", "noir", "nostalgic", "playful", "quirky", "romantic", "serene", "stylish", "surreal", "tense", "tragic", "triumphant", "unsettling", "warm"];
export const MAX_MOODS = 4;
// Checkbox state -> confidence value sent to the bot.
export const CONFIDENCE = { c: "certain", m: "mitigated" };
