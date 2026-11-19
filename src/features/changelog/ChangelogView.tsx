import { Fragment, useContext, useId, useMemo, useState } from "react";
import { ChevronDown, ListChecks, Package, Search, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { LanguageContext } from "@/i18n/context";
import { translateUI } from "@/i18n/translate";
import type { Language } from "@/i18n/language";
import releaseTranslations from "./releaseTranslations.json";
import { cn } from "@/utils/cn";
import changelogSource from "../../../CHANGELOG.txt?raw";
import {
  parseChangelog,
  type ChangelogBlock,
  type ChangelogRelease,
} from "./parseChangelog";

/** CHANGELOG.txt is the single source of truth: new releases appear here automatically. */
const RELEASES = parseChangelog(changelogSource);
const TOTAL_CHANGES = RELEASES.reduce((sum, r) => sum + r.changeCount, 0);

const translations: Record<string, { en: string; th: string; detailsEn?: string[] }> = releaseTranslations;

function localizeRelease(release: ChangelogRelease, language: Language): ChangelogRelease {
  const copy = translations[release.title];
  return {
    ...release,
    title: copy?.[language] ?? release.title,
    blocks: language === "en" && copy?.detailsEn
      ? [{ type: "list", kind: "change", title: null, items: copy.detailsEn }]
      : release.blocks,
  };
}

const countLabel = (n: number, unit: "release" | "change", language: Language) =>
  language === "th" ? `${n} ${unit === "release" ? "รุ่น" : "รายการ"}` : `${n} ${unit}${n === 1 ? "" : "s"}`;

function formatDate(iso: string, language: "en" | "th"): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  // Keep the Gregorian year in Thai so it matches the dates written in CHANGELOG.txt.
  return new Intl.DateTimeFormat(
    language === "th" ? "th-TH-u-ca-gregory" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(date);
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-gold-500/25 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** "Label: detail" lines get a bold label so long lists are easy to scan. */
function splitLabel(text: string): [string | null, string] {
  const match = text.match(/^([^:]{2,36}):\s+([\s\S]+)$/);
  return match ? [match[1], match[2]] : [null, text];
}

function Item({ text, query }: { text: string; query: string }) {
  const [label, detail] = splitLabel(text);
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500/70"
      />
      <span
        translate="no"
        className="min-w-0 text-[15px] leading-relaxed text-ink-muted"
      >
        {label && (
          <strong className="font-semibold text-ink">
            <Highlight text={label} query={query} />
            {": "}
          </strong>
        )}
        <Highlight text={detail} query={query} />
      </span>
    </li>
  );
}

function Block({ block, query }: { block: ChangelogBlock; query: string }) {
  if (block.type === "note")
    return (
      <p
        translate="no"
        className="whitespace-pre-line text-sm leading-relaxed text-ink-muted"
      >
        <Highlight text={block.text} query={query} />
      </p>
    );
  return (
    <section>
      {block.title && (
        <h4
          translate="no"
          className="mb-2.5 text-sm font-bold text-gold-300"
        >
          <Highlight text={translateUI(block.title)} query={query} />
        </h4>
      )}
      <ul className="space-y-2">
        {block.items.map((item, i) => (
          <Item key={i} text={item} query={query} />
        ))}
      </ul>
    </section>
  );
}

function ReleaseBody({
  release,
  query,
}: {
  release: ChangelogRelease;
  query: string;
}) {
  const changes = release.blocks.filter((b) => b.kind === "change");
  const extras = release.blocks.filter((b) => b.kind !== "change");
  const hasVerify = extras.some((b) => b.kind === "verify");
  const hasPackage = extras.some((b) => b.kind === "package");
  return (
    <div className="space-y-6">
      {changes.map((block, i) => (
        <Block key={i} block={block} query={query} />
      ))}
      {extras.length > 0 && (
        // Re-mount when a search starts or stops so matches inside open automatically.
        <details
          key={query ? "search" : "browse"}
          open={Boolean(query)}
          className="group rounded-xl border border-white/[0.07] bg-navy-900/60"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            {hasVerify ? (
              <ListChecks size={16} aria-hidden />
            ) : (
              <Package size={16} aria-hidden />
            )}
            <span>
              {hasVerify && hasPackage
                ? "Checks & files"
                : hasVerify
                  ? "Checks"
                  : "Files"}
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className="ml-auto transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="space-y-5 border-t border-white/[0.07] px-4 py-4">
            {extras.map((block, i) => (
              <Block key={i} block={block} query={query} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ReleaseCard({
  release,
  changeCount,
  isLatest,
  open,
  onToggle,
  query,
}: {
  release: ChangelogRelease;
  changeCount: number;
  isLatest: boolean;
  open: boolean;
  onToggle: () => void;
  query: string;
}) {
  const bodyId = useId();
  const language = useContext(LanguageContext);
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-navy-800">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-14 w-full items-start gap-3 p-4 text-left hover:bg-white/[0.03] sm:p-5"
        >
          <span className="min-w-0 flex-1">
            <span
              translate="no"
              className="block break-words font-display text-base font-bold text-ink sm:text-lg"
            >
              <Highlight text={release.title} query={query} />
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {isLatest && <Badge tone="gold">Latest</Badge>}
              <Badge>{countLabel(changeCount, "change", language)}</Badge>
            </span>
          </span>
          <ChevronDown
            size={20}
            aria-hidden
            className={cn(
              "mt-1 shrink-0 text-ink-faint transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      {open && (
        <div
          id={bodyId}
          className="border-t border-white/[0.07] p-4 pt-5 sm:p-5 sm:pt-6"
        >
          <ReleaseBody release={release} query={query} />
        </div>
      )}
    </article>
  );
}

function filterRelease(
  release: ChangelogRelease,
  q: string,
): ChangelogRelease | null {
  if (!q) return release;
  const has = (text: string) => text.toLowerCase().includes(q);
  // A title or date match keeps the whole release.
  if (has(release.title) || has(release.date)) return release;
  const blocks: ChangelogBlock[] = [];
  for (const block of release.blocks) {
    if (block.type === "note") {
      if (has(block.text)) blocks.push(block);
    } else if (block.title && has(block.title)) {
      blocks.push(block);
    } else {
      const items = block.items.filter(has);
      if (items.length) blocks.push({ ...block, items });
    }
  }
  return blocks.length ? { ...release, blocks } : null;
}

export function ChangelogView() {
  const language = useContext(LanguageContext);
  const [query, setQuery] = useState("");
  // Explicit open/close choices; anything not chosen follows the default
  // (latest release open while browsing, every match open while searching).
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const latestId = RELEASES[0]?.id;

  const shown = useMemo(
    () =>
      RELEASES.flatMap(
        (release): Array<{ release: ChangelogRelease; total: number }> => {
          const localized = localizeRelease(release, language);
          const filtered = filterRelease(localized, q);
          return filtered
            ? [{ release: filtered, total: release.changeCount }]
            : [];
        },
      ),
    [q, language],
  );

  const groups = useMemo(() => {
    const result: Array<{ date: string; items: typeof shown }> = [];
    for (const entry of shown) {
      const last = result.at(-1);
      if (last && last.date === entry.release.date) last.items.push(entry);
      else result.push({ date: entry.release.date, items: [entry] });
    }
    return result;
  }, [shown]);

  const isOpen = (id: string) => manual[id] ?? (q ? true : id === latestId);
  const setAll = (value: boolean) =>
    setManual(Object.fromEntries(shown.map((s) => [s.release.id, value])));
  const search = (value: string) => {
    setQuery(value);
    setManual({});
  };

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">Older release details are shown in their original language.</p>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone="gold">{countLabel(RELEASES.length, "release", language)}</Badge>
        <Badge>{countLabel(TOTAL_CHANGES, "change", language)}</Badge>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search changes"
            aria-label="Search the changelog"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-navy-800 py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => search("")}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:text-ink"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="section-tab border-white/10"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="section-tab border-white/10"
          >
            Collapse all
          </button>
        </div>
      </div>

      {q && (
        <p className="mb-4 text-sm text-ink-muted" role="status">
          {shown.length === 0
            ? "No changes match your search."
            : language === "th"
              ? `พบ ${shown.length} จาก ${RELEASES.length} รุ่น`
              : `${shown.length} of ${RELEASES.length} releases match`}
        </p>
      )}

      <ol className="relative ml-2 space-y-9 border-l border-white/10 pl-5 sm:pl-7">
        {groups.map((group) => (
          <li key={group.date} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.63rem] top-1.5 h-3 w-3 rounded-full border-2 border-gold-500 bg-navy-950 sm:-left-[2.13rem]"
            />
            <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 font-display text-base font-bold text-ink">
              <time dateTime={group.date}>
                {formatDate(group.date, language)}
              </time>
              <span className="text-xs font-medium text-ink-faint">
                {countLabel(group.items.length, "release", language)}
              </span>
            </h2>
            <div className="space-y-3">
              {group.items.map(({ release, total }) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  changeCount={total}
                  isLatest={release.id === latestId}
                  open={isOpen(release.id)}
                  onToggle={() =>
                    setManual((m) => ({
                      ...m,
                      [release.id]: !isOpen(release.id),
                    }))
                  }
                  query={q}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
