/** Small diagnostic logger. Keeps a ring buffer so failures can be inspected from the console: window.__ccmLog */
type Entry = { t: string; scope: string; message: string; detail?: unknown };

const MAX_ENTRIES = 100;
const buffer: Entry[] = [];

function push(level: 'warn' | 'error', scope: string, message: string, detail?: unknown): void {
  buffer.push({ t: new Date().toISOString(), scope, message, detail });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  if (typeof window !== 'undefined') (window as unknown as { __ccmLog?: Entry[] }).__ccmLog = buffer;
  console[level](`[ccm:${scope}] ${message}`, detail ?? '');
}

export const logWarn = (scope: string, message: string, detail?: unknown): void => push('warn', scope, message, detail);
export const logError = (scope: string, message: string, detail?: unknown): void => push('error', scope, message, detail);
