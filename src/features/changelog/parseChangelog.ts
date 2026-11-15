/**
 * Turns the plain-text CHANGELOG.txt into structured releases for the Changelog page.
 * CHANGELOG.txt stays the single source of truth: add a new release at the top of the
 * file and it appears in the menu automatically.
 *
 * Supported release headers (the two styles used in the file):
 *   Chess Career Mode — Title            Chess Career Mode — Title (2026-11-14)
 *   2026-11-15
 * Inside a release:
 *   Heading            -> a titled section (the following "- " lines are its items)
 *   - item             -> a bullet (an untitled section when there is no heading)
 *   plain text         -> a note
 * Divider lines (=====, ----- Previous releases -----, ประวัติรุ่นก่อน) are ignored.
 */

export type SectionKind = "change" | "verify" | "package";

export type ChangelogBlock =
  | { type: "list"; title: string | null; kind: SectionKind; items: string[] }
  | { type: "note"; kind: SectionKind; text: string };

export interface ChangelogRelease {
  id: string;
  /** Full header, e.g. "Chess Career Mode — Sponsor Select Tours". */
  fullTitle: string;
  /** Header without the "Chess Career Mode —" prefix. */
  title: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  blocks: ChangelogBlock[];
  /** Number of bullets that describe changes (excludes verification and packaging notes). */
  changeCount: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEADER_WITH_DATE = /^(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/;
const PRODUCT_PREFIX = /^Chess Career Mode\s*[—–-]\s*/i;
const DIVIDER =
  /^(?:[=\-_*]{4,}|[-=]{3,}.*[-=]{3,}|ประวัติรุ่นก่อน|Previous releases)$/i;

const VERIFY_TITLE = /ตรวจสอบ|ทดสอบ|ตรวจ|playtest|verification|tested?\b/i;
const PACKAGE_TITLE = /ไฟล์ส่งมอบ|ส่งมอบ|deliverables?|รุ่น\s*lite/i;

export function classify(text: string): SectionKind {
  const head = text.trim();
  if (PACKAGE_TITLE.test(head.slice(0, 40))) return "package";
  if (VERIFY_TITLE.test(head.slice(0, 40))) return "verify";
  return "change";
}

const isBullet = (line: string) => /^\s*[-•*]\s+\S/.test(line);
const bulletText = (line: string) => line.replace(/^\s*[-•*]\s+/, "").trim();
const isDivider = (line: string) => DIVIDER.test(line.trim());

interface Header {
  fullTitle: string;
  date: string;
  /** Lines consumed by the header (1 or 2). */
  span: number;
}

function readHeader(lines: string[], i: number): Header | null {
  const line = lines[i].trim();
  if (!line || isBullet(line) || isDivider(line)) return null;
  const next = (lines[i + 1] ?? "").trim();
  if (DATE.test(next) && !DATE.test(line))
    return { fullTitle: line, date: next, span: 2 };
  const match = line.match(HEADER_WITH_DATE);
  if (match && PRODUCT_PREFIX.test(match[1]))
    return { fullTitle: match[1].trim(), date: match[2], span: 1 };
  return null;
}

function parseBody(lines: string[]): ChangelogBlock[] {
  const blocks: ChangelogBlock[] = [];
  let list: Extract<ChangelogBlock, { type: "list" }> | null = null;
  let heading: string | null = null;
  let note: string[] = [];

  const flushNote = () => {
    if (!note.length) return;
    const text = note.join("\n");
    blocks.push({ type: "note", kind: classify(text), text });
    note = [];
  };
  const endList = () => {
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || isDivider(line)) {
      flushNote();
      endList();
      heading = null;
      continue;
    }
    if (isBullet(line)) {
      flushNote();
      if (!list) {
        const title = heading;
        list = {
          type: "list",
          title,
          kind: title ? classify(title) : "change",
          items: [],
        };
        blocks.push(list);
        heading = null;
      }
      list.items.push(bulletText(line));
      continue;
    }
    // A plain line directly followed by a bullet is a section heading.
    if (isBullet(lines[i + 1] ?? "")) {
      flushNote();
      endList();
      heading = line.replace(/[:：]\s*$/, "").trim();
      continue;
    }
    endList();
    note.push(line);
  }
  flushNote();
  return blocks;
}

export function parseChangelog(source: string): ChangelogRelease[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const starts: Array<{ index: number; header: Header }> = [];
  for (let i = 0; i < lines.length; i++) {
    const header = readHeader(lines, i);
    if (header) {
      starts.push({ index: i, header });
      i += header.span - 1;
    }
  }
  return starts.map(({ index, header }, n) => {
    const end = n + 1 < starts.length ? starts[n + 1].index : lines.length;
    const blocks = parseBody(lines.slice(index + header.span, end));
    const changeCount = blocks.reduce(
      (sum, block) =>
        block.type === "list" && block.kind === "change"
          ? sum + block.items.length
          : sum,
      0,
    );
    const title = header.fullTitle.replace(PRODUCT_PREFIX, "").trim();
    return {
      id: `${header.date}-${n}`,
      fullTitle: header.fullTitle,
      title: title || header.fullTitle,
      date: header.date,
      blocks,
      changeCount,
    };
  });
}
