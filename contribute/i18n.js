// One JSON file per language in locales/. To add one: copy en.json, add its code to LANGS.
export const DEFAULT_LOCALE = "en";
export const LANGS = ["en", "fr"];

const replaceVariables = (text, variables) =>
  text.replace(/\{([^}]+)\}/g, (_, key) => (variables[key] === undefined ? `{${key}}` : String(variables[key])));

// t(key, vars): missing keys fall back to English, then show as [key].
// t.plural(key, n) picks key.one / key.other.
export function createTranslator({ locale, fallbackLocale = DEFAULT_LOCALE, messages }) {
  const active = messages[locale] ?? {};
  const fallback = messages[fallbackLocale] ?? {};
  const has = (key) => key in active || key in fallback;

  const t = (key, variables = {}) => {
    const text = active[key] ?? fallback[key];
    if (text === undefined) {
      return replaceVariables(fallback["errors.missingTranslation"] ?? key, { key, ...variables });
    }
    return replaceVariables(text, variables);
  };

  t.has = has;
  t.plural = (key, n, variables = {}) => {
    const form = new Intl.PluralRules(locale).select(n);
    const full = has(`${key}.${form}`) ? `${key}.${form}` : `${key}.other`;
    return t(full, { n, ...variables });
  };
  return t;
}

export async function loadLocale(locale, { fetcher = fetch } = {}) {
  const response = await fetcher(new URL(`./locales/${locale}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Impossible de charger la langue : ${locale}`);
  return response.json();
}

// First supported language from the list, else English.
export function pickLocale(candidates) {
  for (const candidate of candidates) {
    const base = String(candidate ?? "").split("-")[0].toLowerCase();
    if (LANGS.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}
