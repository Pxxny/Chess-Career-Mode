import {
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LanguageContext } from "./context";
import {
  DEFAULT_LANGUAGE,
  getLanguage,
  LANGUAGE_STORAGE_KEY,
  receiveLanguagePreference,
  subscribeLanguage,
} from "./language";
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => DEFAULT_LANGUAGE,
  );
  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null)
        receiveLanguagePreference(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}
