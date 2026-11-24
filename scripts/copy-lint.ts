/**
 * CI copy lint.
 *
 * 1. UI copy (JSX text and string literals in src/app and src/components): banned words from
 *    the product-voice skill, exclamation marks and em dashes.
 * 2. Prompt templates and feedback (src/lib/ai, src/lib/demo, src/lib/rubrics): banned feedback
 *    phrases from the student-feedback-writing skill, exclamation marks and em dashes.
 *
 * Exits 1 with a list of hits. Run: npm run lint:copy
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { BANNED_FEEDBACK_PHRASES, BANNED_UI_WORDS } from "../src/lib/copy/banned";

type Hit = { file: string; line: number; text: string; reason: string };

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, exts);
    return exts.some((e) => full.endsWith(e)) ? [full] : [];
  });
}

/** Attributes whose values are code, not copy. */
const CODE_ATTRIBUTES = new Set(["className", "href", "src", "id", "htmlFor", "name", "type", "accept", "autoComplete", "role", "rel", "target", "value", "defaultValue", "key", "data-quote", "aria-current"]);

function looksLikeCode(text: string) {
  return /^[a-z0-9_./:@\-[\]=#?&%{}()*+|^$\\]*$/i.test(text) || /^(\/|\.\/|@\/|https?:)/.test(text) || /[[\]]/.test(text) && /\[/.test(text) && !/\s/.test(text);
}

function strings(file: string): { text: string; line: number }[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node) && CODE_ATTRIBUTES.has(node.name.getText(source))) return;
    if (ts.isCallExpression(node) && /^(cn|cva|querySelector|closest|split|replace|match|test|startsWith|endsWith|includes|join)$/.test(node.expression.getText(source).split(".").pop() ?? "")) return;
    if (ts.isRegularExpressionLiteral(node)) return;
    const push = (text: string) => {
      const t = text.trim();
      if (t.length > 1 && !looksLikeCode(t)) out.push({ text: t, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    };
    if (ts.isJsxText(node)) push(node.getText(source));
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) push(node.text);
    else if (ts.isTemplateExpression(node)) {
      push(node.head.text);
      node.templateSpans.forEach((s) => push(s.literal.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function phraseHit(text: string, phrases: readonly string[]) {
  const lower = text.toLowerCase().replace(/’/g, "'");
  return phrases.find((p) => new RegExp(`(?<![a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(lower));
}

const hits: Hit[] = [];

for (const file of [...walk("src/app", [".tsx", ".ts"]), ...walk("src/components", [".tsx"])]) {
  if (file.includes(`${path.sep}api${path.sep}`) && !file.endsWith("route.ts")) continue;
  for (const { text, line } of strings(file)) {
    const word = phraseHit(text, BANNED_UI_WORDS);
    if (word) hits.push({ file, line, text, reason: `banned word "${word}"` });
    if (/\w!(\s|$)/.test(text)) hits.push({ file, line, text, reason: "exclamation mark" });
    if (text.includes("—")) hits.push({ file, line, text, reason: "em dash" });
  }
}

for (const file of [...walk("src/lib/ai", [".ts"]), ...walk("src/lib/demo", [".ts"]), ...walk("src/lib/rubrics", [".ts"])]) {
  for (const { text, line } of strings(file)) {
    const phrase = phraseHit(text, BANNED_FEEDBACK_PHRASES);
    if (phrase) hits.push({ file, line, text: text.slice(0, 120), reason: `banned feedback phrase "${phrase}"` });
    if (/\w!(\s|$)/.test(text)) hits.push({ file, line, text: text.slice(0, 120), reason: "exclamation mark" });
    if (text.includes("—")) hits.push({ file, line, text: text.slice(0, 120), reason: "em dash" });
  }
}

if (hits.length) {
  console.error(`Copy lint found ${hits.length} problem(s):`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.reason}  ${JSON.stringify(h.text.slice(0, 100))}`);
  process.exit(1);
}
console.log("Copy lint passed.");
