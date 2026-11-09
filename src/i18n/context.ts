import { createContext } from "react";
import type { Language } from "./language";
export const LanguageContext = createContext<Language>("en");
export const OriginalTextContext = createContext(false);
