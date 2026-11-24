import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { QR_TOKEN_ALPHABET, generateQrToken, orderSheets, type OrderToken } from "@/lib/packet/order";
import { ANSWER_SHEET_LAYOUT, renderPacketPdf, type PacketInput } from "@/lib/packet/render";
import { findQr, pdfPageCount, splitPdfToImages } from "@/lib/pipeline/images";

const APP_URL = "https://app.example.com";

const students = [
  { id: "s1", firstName: "Maria", lastName: "Gonzalez-Rodriguez", rosterIndex: 0 },
  { id: "s2", firstName: "ben", lastName: "adams", rosterIndex: 1 },
  { id: "s3", firstName: "Li", lastName: "Wu", rosterIndex: 2 },
];

function makeTokens(pagesPerStudent: number, spareSets: number, sparePages: number): OrderToken[] {
  const tokens: OrderToken[] = [];
  for (const s of students) {
    for (let p = 1; p <= pagesPerStudent; p++) tokens.push({ token: generateQrToken(), studentId: s.id, pageNumber: p });
  }
  for (let set = 1; set <= spareSets; set++) {
    for (let p = 1; p <= sparePages; p++) tokens.push({ token: generateQrToken(), studentId: null, pageNumber: p, spareSet: set });
  }
  return tokens;
}

function baseInput(sheets: PacketInput["sheets"], overrides: Partial<PacketInput> = {}): PacketInput {
  return {
    appUrl: APP_URL,
    className: "Period 3",
    courseLabel: "AP U.S. History",
    assignmentTitle: "Market Revolution DBQ",
    essayTypeLabel: "Document-based question",
    promptText: "Evaluate the extent to which the Market Revolution changed the lives of American workers from 1815 to 1850.",
    sources: [
      { number: 1, citation: "Source: a mill worker's letter, 1840", text: "We rise at five and work until seven." },
      { number: 2, citation: "Source: a newspaper editorial, 1845", text: "The canal has brought goods to every town." },
    ],
    timeLimitMinutes: 60,
    readingMinutes: 15,
    rubricRows: [
      { label: "Thesis", maxPoints: 1, studentWording: "Make a claim that answers the question." },
      { label: "Evidence from the documents", maxPoints: 2, studentWording: "Use what the documents say." },
    ],
    sheets,
    paperSize: "LETTER",
    doubleSided: false,
    ...overrides,
  };
}

const pageCount = pdfPageCount;

/** Renders the PDF at 144 dpi (2 px per point) and returns the page at `index` (0-based; negative counts from the end). */
async function renderPage(pdf: Buffer, index: number): Promise<{ image: Buffer; width: number; height: number }> {
  const images = await splitPdfToImages(pdf, { dpi: 144 });
  const image = images.at(index);
  if (!image) throw new Error(`No page at index ${index}`);
  const meta = await sharp(image).metadata();
  return { image, width: meta.width ?? 0, height: meta.height ?? 0 };
}

describe("generateQrToken", () => {
  it("returns 12 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const token = generateQrToken();
      expect(token).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
      expect(token).not.toMatch(/[01ILO]/);
    }
    expect(QR_TOKEN_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 2000 }, generateQrToken));
    expect(tokens.size).toBe(2000);
  });
});

describe("orderSheets", () => {
  it("orders by roster, pages in order, spares last", () => {
    const sheets = orderSheets({ students, tokens: makeTokens(2, 1, 2), order: "roster", pagesPerStudent: 2 });
    expect(sheets.map((s) => `${s.studentName ?? "spare"}:${s.pageNumber}/${s.pageCount}`)).toEqual([
      "Maria Gonzalez-Rodriguez:1/2",
      "Maria Gonzalez-Rodriguez:2/2",
      "ben adams:1/2",
      "ben adams:2/2",
      "Li Wu:1/2",
      "Li Wu:2/2",
      "spare:1/2",
      "spare:2/2",
    ]);
    expect(sheets.at(-1)?.spareSet).toBe(1);
  });

  it("orders alphabetically by last name, ignoring case", () => {
    const sheets = orderSheets({ students, tokens: makeTokens(1, 0, 0), order: "alphabetical", pagesPerStudent: 1 });
    expect(sheets.map((s) => s.studentName)).toEqual(["ben adams", "Maria Gonzalez-Rodriguez", "Li Wu"]);
  });

  it("throws when a student is missing a page token", () => {
    const tokens = makeTokens(2, 0, 0).filter((t) => !(t.studentId === "s2" && t.pageNumber === 2));
    expect(() => orderSheets({ students, tokens, order: "roster", pagesPerStudent: 2 })).toThrow(/ben adams, page 2/);
  });
});

describe("renderPacketPdf", () => {
  it("renders prompt pages, documents and one page per answer sheet with a readable QR code", async () => {
    const sheets = orderSheets({ students, tokens: makeTokens(2, 1, 2), order: "roster", pagesPerStudent: 2 });
    expect(sheets).toHaveLength(8);

    const frontPages = await pageCount(await renderPacketPdf(baseInput([])));
    expect(frontPages).toBeGreaterThanOrEqual(2); // prompt page plus at least one documents page

    const pdf = await renderPacketPdf(baseInput(sheets));
    expect(await pageCount(pdf)).toBe(frontPages + 8);

    const scale = 2; // 144 dpi
    const page = await renderPage(pdf, frontPages);
    const hit = await findQr(page.image);
    expect(hit?.text).toBe(`${APP_URL}/q/${sheets[0].token}`);

    const xs = hit!.corners.map((c) => c.x);
    const ys = hit!.corners.map((c) => c.y);
    expect(Math.min(...xs)).toBeLessThan(page.width / 2);
    expect(Math.min(...ys)).toBeLessThan(page.height / 2);
    // The whole QR code sits inside the header box that the image pipeline blanks.
    expect(Math.max(...ys)).toBeLessThan(ANSWER_SHEET_LAYOUT.headerBottomPt * scale);
  });

  it("decodes the spare sheet QR code too", async () => {
    const sheets = orderSheets({ students: [], tokens: makeTokens(0, 1, 1), order: "roster", pagesPerStudent: 1 });
    const pdf = await renderPacketPdf(baseInput(sheets, { sources: [], paperSize: "A4" }));
    const last = await renderPage(pdf, -1);
    const hit = await findQr(last.image);
    expect(hit?.text).toBe(`${APP_URL}/q/${sheets[0].token}`);
  });

  it("pads double-sided packets so every set starts on a front side", async () => {
    const sheets = orderSheets({ students, tokens: makeTokens(3, 0, 0), order: "roster", pagesPerStudent: 3 });
    const front = await pageCount(await renderPacketPdf(baseInput([])));
    const pdf = await renderPacketPdf(baseInput(sheets, { doubleSided: true }));
    const frontPadded = front + (front % 2);
    // 3 students x (3 pages + 1 blank)
    expect(await pageCount(pdf)).toBe(frontPadded + 3 * 4);
  });
});
