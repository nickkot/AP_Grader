/**
 * Remove student names and ID numbers from essay text before it is sent to a model.
 *
 * - Full names of every student on the roster ("Maya Chen", "Chen, Maya") are always replaced.
 * - The author's own first or last name is replaced inside a short header line at the top of
 *   the essay (for example "Maya, Period 3") and after "my name is".
 * - The author's names are NOT replaced elsewhere on their own, because history essays are
 *   full of names a student may share: a student named Maya Jackson still needs
 *   "Jackson vetoed the bank" sent as written.
 * - Runs of 5 or more digits (student ID numbers) are replaced. 4-digit years are kept.
 *
 * Handwritten pages also have their printed header blanked in the image before transcription.
 */

export const NAME_PLACEHOLDER = "[student]";
export const NUMBER_PLACEHOLDER = "[number]";

export type RosterName = { firstName: string; lastName: string };

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameParts(name: RosterName): string[] {
  return [name.firstName, name.lastName]
    .flatMap((n) => n.split(/[\s-]+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length);
}

function wordRegex(word: string, flags = "gu") {
  return new RegExp(`(?<![\\p{L}])${escape(word)}(?![\\p{L}])`, flags);
}

const HEADER_LINE_MAX_WORDS = 10;
const HEADER_LINES = 3;

export function redactText(text: string, author: RosterName | null, roster: RosterName[]): string {
  let out = text;

  // 1. Full names of everyone on the roster, both orders.
  const fullNames = roster
    .filter((r) => r.firstName && r.lastName)
    .flatMap((r) => [`${r.firstName} ${r.lastName}`, `${r.lastName}, ${r.firstName}`])
    .sort((a, b) => b.length - a.length);
  for (const full of fullNames) {
    const pattern = full.split(/\s+/).map(escape).join("\\s+");
    out = out.replace(new RegExp(`(?<![\\p{L}])${pattern}(?![\\p{L}])`, "giu"), NAME_PLACEHOLDER);
  }

  if (author) {
    const parts = nameParts(author);

    // 2. Short header lines at the top ("Maya", "Chen, period 3").
    const lines = out.split("\n");
    let seen = 0;
    for (let i = 0; i < lines.length && seen < HEADER_LINES; i++) {
      if (!lines[i].trim()) continue;
      seen++;
      if (lines[i].trim().split(/\s+/).length > HEADER_LINE_MAX_WORDS) break;
      for (const part of parts) lines[i] = lines[i].replace(wordRegex(part, "giu"), NAME_PLACEHOLDER);
    }
    out = lines.join("\n");

    // 3. "My name is Maya".
    for (const part of parts) {
      out = out.replace(
        new RegExp(`(my name is|i am|i'm)\\s+${escape(part)}(?![\\p{L}])`, "giu"),
        (_m, lead: string) => `${lead} ${NAME_PLACEHOLDER}`,
      );
    }
  }

  // 4. Long digit runs (ID numbers). Years and small numbers stay.
  out = out.replace(/(?<!\d)\d{5,}(?!\d)/g, NUMBER_PLACEHOLDER);

  return out;
}
