/** Edition dates belong to the running record; the title identifies its recurring series. */
export function eventSeriesName(name: string): string {
  return name.trim()
    .replace(/\s*(?:[·—–-]\s*)?(?:19|20|21)\d{2}\/\d{1,2}(?:\s*·\s*\d+)?(?=\s|$)/g, "")
    .replace(/\s*[·—–-]?\s*\b(?:19|20|21)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const eventSeriesKey = (name: string) => eventSeriesName(name).toLocaleLowerCase("en");
