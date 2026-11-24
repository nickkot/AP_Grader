/**
 * Generates the handwritten demo pages used by the seed script and the
 * onboarding sample class: one JPEG per answer page for each demo DBQ essay,
 * made to look like a phone photo of a handwritten exam page.
 *
 *   npx tsx scripts/make-demo-pages.ts
 *
 * Output: src/lib/demo/pages/<essayKey>-p<N>.jpg and manifest.json.
 * The essays and names are invented. The QR codes point at example.invalid,
 * so they never resolve to a real assignment.
 */
import fs from "node:fs";
import path from "node:path";

import QRCode from "qrcode";
import sharp from "sharp";
import { chromium, type Browser } from "playwright";

import { DEMO_DBQ, DEMO_DBQ_ESSAYS, type DemoEssay } from "../src/lib/demo/content";

const OUT_DIR = path.resolve(__dirname, "../src/lib/demo/pages");
const FONT_FILE = path.resolve(__dirname, "../node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff2");

// Letter size at 150 dpi.
const PAGE_W = 1275;
const PAGE_H = 1650;
const MARGIN_X = 96;
const HEADER_TOP = 64;
const QR_SIZE = 132;
const RULE_Y = HEADER_TOP + QR_SIZE + 28;
const FIRST_LINE_Y = RULE_Y + 92;
const LINE_SPACING = 58;
const LINES_PER_PAGE = 22;
const FONT_SIZE = 44;
const INDENT = 64;
const TEXT_WIDTH = PAGE_W - MARGIN_X * 2 - 24;

export type DemoPageManifestEntry = {
  essayKey: string;
  pageNumber: number;
  pageCount: number;
  file: string;
  /** Exact handwritten lines on the page. Crossed-out words appear as [deleted: word]. */
  lines: string[];
  /** The essay text on this page, without crossed-out words, paragraphs separated by a blank line. */
  text: string;
  /** True when the first line on this page continues a paragraph from the previous page. */
  continuesParagraph: boolean;
};

type Token = { text: string; deleted: boolean };
type Line = { tokens: Token[]; paragraphStart: boolean; paragraphIndex: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Splits an essay into paragraphs of tokens and inserts two crossed-out false starts. */
function tokenize(essay: DemoEssay): Token[][] {
  const paragraphs = essay.text.split(/\n\s*\n/).map((p) => p.trim().split(/\s+/));
  const total = paragraphs.reduce((n, p) => n + p.length, 0);
  const targets = [Math.floor(total * 0.18), Math.floor(total * 0.63)];
  let index = 0;
  const out: Token[][] = [];
  for (const words of paragraphs) {
    const tokens: Token[] = [];
    for (const word of words) {
      if (targets.length && index >= targets[0]) {
        const bare = word.replace(/[^A-Za-z]/g, "");
        if (bare.length >= 5 && bare === word) {
          tokens.push({ text: word.slice(0, Math.ceil(word.length / 2) + 1), deleted: true });
          targets.shift();
        }
      }
      tokens.push({ text: word, deleted: false });
      index++;
    }
    out.push(tokens);
  }
  return out;
}

async function measureLines(browser: Browser, fontCss: string, paragraphs: Token[][]): Promise<Line[]> {
  const page = await browser.newPage();
  await page.setContent(`<html><head><style>${fontCss}</style></head><body><span style="font-family:Caveat">x</span></body></html>`);
  await page.evaluate(async (size) => {
    await document.fonts.load(`${size}px Caveat`);
  }, FONT_SIZE);
  const result = await page.evaluate(
    ({ paragraphs, size, width, indent }) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `${size}px Caveat`;
      const space = ctx.measureText(" ").width;
      const lines: { tokens: { text: string; deleted: boolean }[]; paragraphStart: boolean; paragraphIndex: number }[] = [];
      paragraphs.forEach((tokens, paragraphIndex) => {
        let current: typeof tokens = [];
        let used = indent;
        let first = true;
        for (const t of tokens) {
          const w = ctx.measureText(t.text).width;
          const next = current.length ? used + space + w : used + w;
          if (current.length && next > width) {
            lines.push({ tokens: current, paragraphStart: first, paragraphIndex });
            first = false;
            current = [t];
            used = w;
          } else {
            current.push(t);
            used = next;
          }
        }
        if (current.length) lines.push({ tokens: current, paragraphStart: first, paragraphIndex });
      });
      return lines;
    },
    { paragraphs, size: FONT_SIZE, width: TEXT_WIDTH, indent: INDENT },
  );
  await page.close();
  return result;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageHtml(opts: {
  fontCss: string;
  qrDataUrl: string;
  studentName: string;
  pageNumber: number;
  pageCount: number;
  lines: Line[];
  ink: string;
  rand: () => number;
}) {
  const ruled = Array.from({ length: LINES_PER_PAGE }, (_, i) => {
    const y = FIRST_LINE_Y + i * LINE_SPACING;
    return `<div class="rule" style="top:${y}px"></div>`;
  }).join("");

  const written = opts.lines
    .map((line, i) => {
      const baseline = FIRST_LINE_Y + i * LINE_SPACING;
      const dx = (opts.rand() - 0.5) * 10 + (line.paragraphStart ? INDENT : 0);
      const dy = (opts.rand() - 0.5) * 6;
      const rot = (opts.rand() - 0.5) * 0.9;
      const spacing = ((opts.rand() - 0.5) * 0.6).toFixed(2);
      const words = line.tokens
        .map((t) =>
          t.deleted
            ? `<span class="del">${escapeHtml(t.text)}</span>`
            : `<span style="display:inline-block;transform:translateY(${((opts.rand() - 0.5) * 3).toFixed(1)}px)">${escapeHtml(t.text)}</span>`,
        )
        .join(" ");
      return `<div class="hw" style="top:${baseline - FONT_SIZE - 5 + dy}px;left:${MARGIN_X + 12 + dx}px;transform:rotate(${rot.toFixed(2)}deg);letter-spacing:${spacing}px">${words}</div>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${opts.fontCss}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${PAGE_W}px; height: ${PAGE_H}px; }
body {
  position: relative; overflow: hidden;
  background: radial-gradient(ellipse at 40% 35%, #fdfcf8 0%, #f6f4ee 70%, #ece9e1 100%);
  font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #222;
}
.qr { position: absolute; left: ${MARGIN_X}px; top: ${HEADER_TOP}px; width: ${QR_SIZE}px; height: ${QR_SIZE}px; }
.head { position: absolute; left: ${MARGIN_X + QR_SIZE + 28}px; top: ${HEADER_TOP + 6}px; right: ${MARGIN_X}px; }
.name { font-size: 30px; font-weight: 700; }
.meta { font-size: 20px; color: #444; margin-top: 10px; line-height: 30px; }
.pageno { position: absolute; right: ${MARGIN_X}px; top: ${HEADER_TOP + 8}px; font-size: 22px; font-weight: 700; }
.headrule { position: absolute; left: ${MARGIN_X}px; right: ${MARGIN_X}px; top: ${RULE_Y}px; border-top: 3px solid #333; }
.hint { position: absolute; left: ${MARGIN_X}px; top: ${RULE_Y + 14}px; font-size: 17px; color: #666; }
.rule { position: absolute; left: ${MARGIN_X}px; right: ${MARGIN_X}px; height: 0; border-top: 2px solid #b9c4d2; }
.foot { position: absolute; left: ${MARGIN_X}px; right: ${MARGIN_X}px; bottom: 56px; font-size: 16px; color: #777; display: flex; justify-content: space-between; }
.hw { position: absolute; white-space: nowrap; font-family: Caveat; font-size: ${FONT_SIZE}px; color: ${opts.ink}; transform-origin: left bottom; opacity: 0.93; }
.del { text-decoration: line-through; text-decoration-thickness: 3px; text-decoration-color: ${opts.ink}; }
</style></head><body>
<img class="qr" src="${opts.qrDataUrl}" alt="">
<div class="head">
  <div class="name">${escapeHtml(opts.studentName)}</div>
  <div class="meta">Period 3 (demo)<br>${escapeHtml(DEMO_DBQ.title)}</div>
</div>
<div class="pageno">Page ${opts.pageNumber} of ${opts.pageCount}</div>
<div class="headrule"></div>
<div class="hint">Write your answer on the lines below. Do not write above this line.</div>
${ruled}
${written}
<div class="foot"><span>Answer sheet</span><span>Page ${opts.pageNumber} of ${opts.pageCount}</span></div>
</body></html>`;
}

/** Makes a flat render look like a phone photo: desk margin, slight tilt, uneven light. */
async function toPhoto(png: Buffer, rand: () => number): Promise<Buffer> {
  const desks = [
    { r: 112, g: 98, b: 84 },
    { r: 138, g: 141, b: 146 },
    { r: 96, g: 104, b: 98 },
  ];
  const desk = desks[Math.floor(rand() * desks.length)];
  const angle = (1 + rand() * 2) * (rand() < 0.5 ? -1 : 1);
  const pad = 70;

  const tilted = await sharp(png)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: desk })
    .rotate(angle, { background: desk })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = tilted.info;
  const lightX = Math.round(rand() * 100);
  const shade = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="${lightX}%" y1="0%" x2="${100 - lightX}%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/>
          <stop offset="55%" stop-color="#000000" stop-opacity="0.03"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.20"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );

  // Sharp resizes before it composites, so shade at full size first.
  const shaded = await sharp(tilted.data).composite([{ input: shade, blend: "over" }]).toBuffer();
  return sharp(shaded)
    .modulate({ brightness: 0.97 + rand() * 0.05, saturation: 0.9 })
    .blur(0.45)
    .resize({ width: 1240 })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".jpg") || f === "manifest.json") fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const fontCss = `@font-face { font-family: Caveat; src: url(data:font/woff2;base64,${fs
    .readFileSync(FONT_FILE)
    .toString("base64")}) format("woff2"); }`;

  const browser = await launch();
  const manifest: DemoPageManifestEntry[] = [];

  for (const essay of DEMO_DBQ_ESSAYS) {
    const rand = mulberry32(hashString(essay.key));
    const paragraphs = tokenize(essay);
    const lines = await measureLines(browser, fontCss, paragraphs);
    const pageCount = Math.ceil(lines.length / LINES_PER_PAGE);
    const ink = rand() < 0.5 ? "#1c2a63" : "#3a3a40";
    const studentName = `${essay.studentFirstName} ${essay.studentLastName}`;
    const pageTexts: { text: string; continuesParagraph: boolean }[] = [];

    for (let p = 0; p < pageCount; p++) {
      const pageLines = lines.slice(p * LINES_PER_PAGE, (p + 1) * LINES_PER_PAGE);
      const qrDataUrl = await QRCode.toDataURL(`https://example.invalid/q/DEMO-${essay.key}-${p + 1}`, {
        margin: 1,
        width: QR_SIZE * 2,
        errorCorrectionLevel: "M",
      });
      const html = pageHtml({ fontCss, qrDataUrl, studentName, pageNumber: p + 1, pageCount, lines: pageLines, ink, rand });

      const page = await browser.newPage({ viewport: { width: PAGE_W, height: PAGE_H } });
      await page.setContent(html);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const png = await page.screenshot({ type: "png" });
      await page.close();

      const file = `${essay.key}-p${p + 1}.jpg`;
      fs.writeFileSync(path.join(OUT_DIR, file), await toPhoto(png, rand));

      // Rebuild this page's text from its lines, keeping paragraph breaks.
      let text = "";
      pageLines.forEach((line, i) => {
        const words = line.tokens.filter((t) => !t.deleted).map((t) => t.text).join(" ");
        if (i === 0) text = words;
        else text += (line.paragraphStart ? "\n\n" : " ") + words;
      });
      const continuesParagraph = p > 0 && !pageLines[0].paragraphStart;
      pageTexts.push({ text, continuesParagraph });

      manifest.push({
        essayKey: essay.key,
        pageNumber: p + 1,
        pageCount,
        file,
        lines: pageLines.map((line) =>
          line.tokens.map((t) => (t.deleted ? `[deleted: ${t.text}]` : t.text)).join(" "),
        ),
        text,
        continuesParagraph,
      });
    }

    // The pages must reassemble into exactly the essay text the scores quote.
    const rebuilt = pageTexts.reduce((acc, pt, i) => (i === 0 ? pt.text : acc + (pt.continuesParagraph ? " " : "\n\n") + pt.text), "");
    const original = essay.text.split(/\n\s*\n/).map((para) => para.trim().split(/\s+/).join(" ")).join("\n\n");
    if (rebuilt !== original) throw new Error(`Page text for ${essay.key} does not rebuild the essay.`);
    console.log(`${essay.key}: ${lines.length} lines, ${pageCount} pages`);
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const total = fs
    .readdirSync(OUT_DIR)
    .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`Wrote ${manifest.length} pages, ${(total / 1024 / 1024).toFixed(2)} MB total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
