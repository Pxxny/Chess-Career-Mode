export type Language = "en" | "th";
export const LANGUAGE_STORAGE_KEY = "chess-career-mode-language";
export const DEFAULT_LANGUAGE: Language = "en";
export function normalizeLanguage(value: unknown): Language {
  return value === "th" ? "th" : DEFAULT_LANGUAGE;
}
function readPreference(): Language {
  try {
    return normalizeLanguage(
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
let language = readPreference();
const listeners = new Set<() => void>();
export const getLanguage = (): Language => language;
export const subscribeLanguage = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setLanguage(value: Language): void {
  const next = normalizeLanguage(value);
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    /* Preference still works for this session. */
  }
  if (language !== next) {
    language = next;
    listeners.forEach((listener) => listener());
  }
}
export function receiveLanguagePreference(value: unknown): void {
  const next = normalizeLanguage(value);
  if (language !== next) {
    language = next;
    listeners.forEach((listener) => listener());
  }
}
