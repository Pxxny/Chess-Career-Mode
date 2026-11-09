import { useContext } from "react";
import { LanguageContext } from "./context";
import { setLanguage, type Language } from "./language";
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const language = useContext(LanguageContext);
  return (
    <label
      translate="no"
      className={`inline-flex shrink-0 items-center gap-2 text-xs text-ink-muted ${compact ? "" : "py-1"}`}
    >
      {!compact && <span>Language / ภาษา</span>}
      <select
        aria-label="Language / ภาษา"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className={`min-h-11 rounded-lg border border-white/15 bg-navy-900 text-sm text-ink ${compact ? "w-[5.25rem] px-2" : "px-3"}`}
      >
        <option value="en">English</option>
        <option value="th">ไทย</option>
      </select>
    </label>
  );
}
