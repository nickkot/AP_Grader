/**
 * Verify that evidence quotes appear verbatim in the essay, and locate them.
 * Matching ignores differences in whitespace, curly versus straight quotes and dash style,
 * because those come from transcription and typing, not from the student's words.
 * Everything else must match exactly, including case.
 */

function normalizeChar(c: string): string {
  if (c === "‘" || c === "’" || c === "ʼ") return "'";
  if (c === "“" || c === "”") return '"';
  if (c === "–" || c === "—") return "-";
  return c;
}

/** Normalized text plus a map from each normalized index back to the original index. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (!lastWasSpace && norm.length > 0) {
        norm += " ";
        map.push(i);
      }
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    norm += normalizeChar(c);
    map.push(i);
  }
  if (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

export function normalizeForMatch(text: string): string {
  return normalizeWithMap(text).norm;
}

/** Trim stray quotation marks and ellipses the model sometimes adds around a quote. */
export function cleanQuote(quote: string): string {
  return quote
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/^(\.\.\.|…)\s*|\s*(\.\.\.|…)$/g, "")
    .trim();
}

export function findQuote(essay: string, quote: string): { start: number; end: number } | null {
  const q = normalizeForMatch(cleanQuote(quote));
  if (q.length < 3) return null;
  const { norm, map } = normalizeWithMap(essay);
  const idx = norm.indexOf(q);
  if (idx === -1) return null;
  const start = map[idx];
  const end = map[idx + q.length - 1] + 1;
  return { start, end };
}

export type PageSpan = { pageId: string; pageNumber: number; start: number; end: number };

/** Join confirmed page texts into one essay, recording where each page sits. */
export function joinPages(pages: { id: string; pageNumber: number; text: string }[]): { text: string; spans: PageSpan[] } {
  let text = "";
  const spans: PageSpan[] = [];
  for (const p of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const body = p.text.trim();
    if (!body) continue;
    if (text.length > 0) text += "\n\n";
    const start = text.length;
    text += body;
    spans.push({ pageId: p.id, pageNumber: p.pageNumber, start, end: text.length });
  }
  return { text, spans };
}

export function pageForOffset(spans: PageSpan[], offset: number): PageSpan | undefined {
  return spans.find((s) => offset >= s.start && offset < s.end);
}
