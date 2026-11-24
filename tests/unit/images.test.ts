import React from "react";
import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";

import {
  blankTopFallback,
  findQr,
  normalizePhoto,
  pdfPageCount,
  processPagePhoto,
  splitPdfToImages,
} from "@/lib/pipeline/images";

const PAGE_W = 1700;
const PAGE_H = 2200;
const QR_LEFT = 100;
const QR_TOP = 80;
const QR_SIZE = 220;
const TOKEN = "http://localhost:3000/q/K7M2PX9QRT";

// Where the printed name sits (to the right of the QR, within its vertical range).
const NAME_BOX = { left: 360, top: 140, width: 420, height: 70 };
// A region of "essay" lines well below the header.
const ESSAY_BOX = { left: 150, top: 800, width: 1200, height: 300 };

async function makePage(opts: { withQr?: boolean } = {}): Promise<Buffer> {
  const withQr = opts.withQr ?? true;
  const essayLines = Array.from({ length: 12 }, (_, i) => {
    const y = 820 + i * 60;
    return `<text x="150" y="${y}" font-family="sans-serif" font-size="34" fill="#111">The Market Revolution changed how Americans worked line ${i + 1}</text>`;
  }).join("");
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}">
      <text x="${NAME_BOX.left}" y="${NAME_BOX.top + 50}" font-family="sans-serif" font-size="44" fill="#000">Jordan Example</text>
      <line x1="80" y1="340" x2="${PAGE_W - 80}" y2="340" stroke="#000" stroke-width="3"/>
      ${essayLines}
    </svg>`,
  );
  const composites: OverlayOptions[] = [{ input: svg, left: 0, top: 0 }];
  if (withQr) {
    const qr = await QRCode.toBuffer(TOKEN, { margin: 1, width: QR_SIZE });
    composites.push({ input: qr, left: QR_LEFT, top: QR_TOP });
  }
  return sharp({ create: { width: PAGE_W, height: PAGE_H, channels: 3, background: "#ffffff" } })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function regionStats(image: Buffer, box: { left: number; top: number; width: number; height: number }) {
  const { data } = await sharp(image).extract(box).grayscale().raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  let dark = 0;
  for (const v of data) {
    if (v < min) min = v;
    if (v < 128) dark++;
  }
  return { min, darkRatio: dark / data.length };
}

function center(corners: { x: number; y: number }[]) {
  return {
    x: corners.reduce((s, c) => s + c.x, 0) / corners.length,
    y: corners.reduce((s, c) => s + c.y, 0) / corners.length,
  };
}

describe("findQr", () => {
  it("decodes the QR on a synthetic page and reports its corners", async () => {
    const page = await makePage();
    const hit = await findQr(page);
    expect(hit?.text).toBe(TOKEN);
    const c = center(hit!.corners);
    expect(c.x).toBeGreaterThan(QR_LEFT);
    expect(c.x).toBeLessThan(QR_LEFT + QR_SIZE);
    expect(c.y).toBeGreaterThan(QR_TOP);
    expect(c.y).toBeLessThan(QR_TOP + QR_SIZE);
  });
});

describe("processPagePhoto", () => {
  it("keeps an upright page upright and blanks the printed name", async () => {
    const page = await makePage();
    const before = await regionStats(page, NAME_BOX);
    expect(before.darkRatio).toBeGreaterThan(0.02);

    const out = await processPagePhoto(page);
    expect(out.qr?.text).toBe(TOKEN);
    expect(out.rotatedDegrees).toBe(0);
    expect(out.headerBlanked).toBe(true);
    expect(out.width).toBe(PAGE_W);
    expect(out.height).toBe(PAGE_H);

    const name = await regionStats(out.image, NAME_BOX);
    expect(name.min).toBeGreaterThan(245);

    const essayBefore = await regionStats(page, ESSAY_BOX);
    const essayAfter = await regionStats(out.image, ESSAY_BOX);
    expect(essayAfter.darkRatio).toBeGreaterThan(0.02);
    expect(Math.abs(essayAfter.darkRatio - essayBefore.darkRatio)).toBeLessThan(0.02);
  });

  it("turns an upside-down page right side up", async () => {
    const page = await sharp(await makePage()).rotate(180).jpeg().toBuffer();
    const out = await processPagePhoto(page);
    expect(out.qr?.text).toBe(TOKEN);
    expect(out.rotatedDegrees).toBe(180);
    const c = center(out.qr!.corners);
    expect(c.y).toBeLessThan(out.height / 2);
    expect(c.x).toBeLessThan(out.width / 2);
    const name = await regionStats(out.image, NAME_BOX);
    expect(name.min).toBeGreaterThan(245);
  });

  it("turns a page photographed sideways (clockwise) upright", async () => {
    const page = await sharp(await makePage()).rotate(90).jpeg().toBuffer();
    const meta = await sharp(page).metadata();
    expect(meta.width).toBeGreaterThan(meta.height!);

    const out = await processPagePhoto(page);
    expect(out.qr?.text).toBe(TOKEN);
    expect(out.rotatedDegrees).toBe(270);
    expect(out.height).toBeGreaterThan(out.width);
    const c = center(out.qr!.corners);
    expect(c.y).toBeLessThan(out.height / 2);
    expect(c.x).toBeLessThan(out.width / 2);
  });

  it("turns a page photographed sideways (counter-clockwise) upright", async () => {
    const page = await sharp(await makePage()).rotate(270).jpeg().toBuffer();
    const out = await processPagePhoto(page);
    expect(out.qr?.text).toBe(TOKEN);
    expect(out.rotatedDegrees).toBe(90);
    expect(out.height).toBeGreaterThan(out.width);
    const c = center(out.qr!.corners);
    expect(c.y).toBeLessThan(out.height / 2);
    expect(c.x).toBeLessThan(out.width / 2);
  });

  it("leaves a page with no QR unblanked", async () => {
    const page = await makePage({ withQr: false });
    const out = await processPagePhoto(page);
    expect(out.qr).toBeNull();
    expect(out.headerBlanked).toBe(false);
    expect(out.rotatedDegrees).toBe(0);
    const name = await regionStats(out.image, NAME_BOX);
    expect(name.darkRatio).toBeGreaterThan(0.02);
  });
});

describe("blankTopFallback", () => {
  it("paints the top 12% white by default", async () => {
    const page = await makePage({ withQr: false });
    const out = await blankTopFallback(page);
    const top = await regionStats(out, { left: 0, top: 0, width: PAGE_W, height: Math.floor(PAGE_H * 0.12) - 1 });
    expect(top.min).toBeGreaterThan(245);
    const essay = await regionStats(out, ESSAY_BOX);
    expect(essay.darkRatio).toBeGreaterThan(0.02);
  });
});

describe("normalizePhoto", () => {
  it("applies EXIF orientation", async () => {
    const raw = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#ffffff" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await normalizePhoto(raw);
    expect(out.width).toBe(400);
    expect(out.height).toBe(600);
    const meta = await sharp(out.image).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("caps the long side at 2400 px", async () => {
    const raw = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toBuffer();
    const out = await normalizePhoto(raw);
    expect(Math.max(out.width, out.height)).toBe(2400);
    expect(out.width).toBe(1800);
  });
});

describe("copier PDFs", () => {
  /** Builds a letter-size PDF. Each page is text, or a full-page image like a copier scan. */
  async function makePdf(pages: ({ text: string } | { image: Buffer })[]): Promise<Buffer> {
    const { Document, Page, Text, Image, renderToBuffer } = await import("@react-pdf/renderer");
    const doc = React.createElement(
      Document,
      null,
      pages.map((p, i) =>
        React.createElement(
          Page,
          { key: i, size: "LETTER", style: { padding: "image" in p ? 0 : 72 } },
          "image" in p
            ? React.createElement(Image, { src: { data: p.image, format: "jpg" }, style: { width: 612, height: 792 } })
            : React.createElement(Text, null, p.text),
        ),
      ),
    );
    return Buffer.from(await renderToBuffer(doc));
  }

  it("counts pages and renders each one", async () => {
    const pdf = await makePdf([{ text: "Answer page 1" }, { text: "Answer page 2" }]);
    expect(await pdfPageCount(pdf)).toBe(2);
    const images = await splitPdfToImages(pdf);
    expect(images).toHaveLength(2);
    for (const img of images) {
      const meta = await sharp(img).metadata();
      expect(meta.format).toBe("jpeg");
      // Letter at 170 dpi: about 1445 x 1870.
      expect(meta.width).toBeGreaterThan(1400);
      expect(meta.width).toBeLessThan(1500);
      expect(meta.height).toBeGreaterThan(1830);
      expect(meta.height).toBeLessThan(1910);
    }
  });

  it("respects maxPages", async () => {
    const pdf = await makePdf([{ text: "1" }, { text: "2" }, { text: "3" }]);
    const images = await splitPdfToImages(pdf, { maxPages: 1, dpi: 72 });
    expect(images).toHaveLength(1);
  });

  it("keeps a scanned page's QR code readable after rendering", async () => {
    const pdf = await makePdf([{ image: await makePage() }]);
    const [image] = await splitPdfToImages(pdf);
    const out = await processPagePhoto(image);
    expect(out.qr?.text).toBe(TOKEN);
    expect(out.rotatedDegrees).toBe(0);
    expect(out.headerBlanked).toBe(true);
  });
});
