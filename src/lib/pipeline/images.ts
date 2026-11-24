import "server-only";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import sharp, { type Sharp } from "sharp";
import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader";

/**
 * Image processing for uploaded answer pages.
 *
 * Packet answer sheets carry a QR code at the top-left of a ~1 inch header
 * band, with the student's printed name to the right of it. We use the QR
 * both to identify the page and to orient it, then paint the header band
 * white so the student's name never reaches the model.
 */

export type QrHit = {
  text: string;
  /** Four points (top-left, top-right, bottom-right, bottom-left), pixel coords in the image passed. */
  corners: { x: number; y: number }[];
};

export type ProcessedPage = {
  /** JPEG, upright, normalized, header blanked when a QR was found. */
  image: Buffer;
  width: number;
  height: number;
  /** Coordinates relative to the returned (upright) image. */
  qr: QrHit | null;
  rotatedDegrees: 0 | 90 | 180 | 270;
  headerBlanked: boolean;
};

const MAX_LONG_SIDE = 2400;
const JPEG_QUALITY = 85;

/* ------------------------------------------------------------------ */
/* zxing-wasm: load the reader WASM from node_modules, never a CDN      */
/* ------------------------------------------------------------------ */

let zxingReady: Promise<unknown> | null = null;

async function resolveZxingWasmPath(): Promise<string> {
  const candidates: string[] = [path.join(process.cwd(), "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm")];
  try {
    // Built from parts so bundlers do not try to compile the .wasm file as a module.
    const specifier = ["zxing-wasm", "reader", "zxing_reader.wasm"].join("/");
    candidates.push(createRequire(path.join(process.cwd(), "package.json")).resolve(specifier));
  } catch {
    // The cwd path above is the one used in Next.js server functions.
  }
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("zxing-wasm reader WASM not found in node_modules.");
}

function ensureZxing(): Promise<unknown> {
  if (!zxingReady) {
    zxingReady = (async () => {
      const wasmPath = await resolveZxingWasmPath();
      const bytes = await readFile(/*turbopackIgnore: true*/ wasmPath);
      const wasmBinary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
    })().catch((err) => {
      zxingReady = null;
      throw err;
    });
  }
  return zxingReady;
}

const READER_OPTIONS: ReaderOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  tryRotate: true,
  tryInvert: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

async function decodeRaw(image: Sharp): Promise<{ hit: QrHit; width: number } | null> {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const results = await readBarcodes(
    { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height } as ImageData,
    READER_OPTIONS,
  );
  const found = results.find((r) => r.isValid && r.text);
  if (!found) return null;
  const p = found.position;
  return {
    hit: {
      text: found.text,
      corners: [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft].map((pt) => ({ x: pt.x, y: pt.y })),
    },
    width: info.width,
  };
}

function scaleHit(hit: QrHit, factor: number): QrHit {
  return { text: hit.text, corners: hit.corners.map((c) => ({ x: c.x * factor, y: c.y * factor })) };
}

/** Finds a QR code. Tries the original, a downscaled copy, then a contrast-normalized grayscale copy. */
export async function findQr(image: Buffer): Promise<QrHit | null> {
  await ensureZxing();
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return null;

  const attempts: { build: () => Sharp; scaleBack: (w: number) => number }[] = [
    { build: () => sharp(image), scaleBack: () => 1 },
  ];
  const longSide = Math.max(width, height);
  if (longSide > 1200) {
    attempts.push({
      build: () => sharp(image).resize({ width: Math.round((width * 1200) / longSide), height: Math.round((height * 1200) / longSide), fit: "fill" }),
      scaleBack: (w) => width / w,
    });
  }
  attempts.push({ build: () => sharp(image).grayscale().normalise(), scaleBack: () => 1 });

  for (const attempt of attempts) {
    const result = await decodeRaw(attempt.build());
    if (result) {
      const factor = attempt.scaleBack(result.width);
      return factor === 1 ? result.hit : scaleHit(result.hit, factor);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Photo normalization, orientation and header blanking                */
/* ------------------------------------------------------------------ */

/** Applies EXIF orientation, caps the long side at 2400 px, outputs JPEG. Color is kept. */
export async function normalizePhoto(input: Buffer): Promise<{ image: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: false })
    .toBuffer({ resolveWithObject: true });
  return { image: data, width: info.width, height: info.height };
}

function qrBounds(qr: QrHit) {
  const xs = qr.corners.map((c) => c.x);
  const ys = qr.corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** Paints white from the top of the page to just below the QR code, full width. */
export async function blankHeader(image: Buffer, qr: QrHit, opts?: { marginRatio?: number }): Promise<Buffer> {
  const marginRatio = opts?.marginRatio ?? 0.35;
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const b = qrBounds(qr);
  const bottom = Math.min(height, Math.ceil(b.maxY + marginRatio * b.h));
  if (bottom <= 0 || width <= 0) return image;
  return paintTopWhite(image, width, bottom);
}

/** Used when no QR was found: paints the top `ratio` of the page white. */
export async function blankTopFallback(image: Buffer, ratio = 0.12): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const bottom = Math.round(height * Math.min(Math.max(ratio, 0), 1));
  if (bottom <= 0 || width <= 0) return image;
  return paintTopWhite(image, width, bottom);
}

async function paintTopWhite(image: Buffer, width: number, bottom: number): Promise<Buffer> {
  const band = await sharp({
    create: { width, height: bottom, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  return sharp(image).composite([{ input: band, left: 0, top: 0 }]).jpeg({ quality: JPEG_QUALITY }).toBuffer();
}

async function rotate(image: Buffer, degrees: 90 | 180 | 270): Promise<Buffer> {
  return sharp(image).rotate(degrees).jpeg({ quality: JPEG_QUALITY }).toBuffer();
}

/**
 * Chooses the clockwise rotation that puts the QR in the top-left region.
 * Portrait pages: QR in the bottom half means upside down (180).
 * Landscape pages: QR on the left half means the page was turned clockwise
 * (rotate 90 clockwise to fix); on the right half, counter-clockwise (270).
 */
function chooseRotation(qr: QrHit, width: number, height: number): 0 | 90 | 180 | 270 {
  const b = qrBounds(qr);
  if (width > height) {
    // Landscape: the QR's original top-left corner now sits on a short edge.
    // Top-left of portrait page rotated 90 CW lands at top-right; rotated 90 CCW lands at bottom-left.
    // Rotating clockwise by 90 maps (x, y) -> (H - y, x): a QR at bottom-left goes to top-left.
    if (b.cy > height / 2) return 90; // QR at bottom-left: page turned CCW, rotate CW 90
    return 270; // QR at top-right: page turned CW, rotate CCW (270 CW)
  }
  if (b.cy > height / 2) return 180;
  return 0;
}

/**
 * Full page processing: normalize, find QR, orient, improve readability,
 * blank the header when a QR is present.
 */
export async function processPagePhoto(input: Buffer): Promise<ProcessedPage> {
  const normalized = await normalizePhoto(input);
  let image = normalized.image;
  let width = normalized.width;
  let height = normalized.height;
  let rotatedDegrees: 0 | 90 | 180 | 270 = 0;

  let qr = await findQr(image);
  if (qr) {
    const rotation = chooseRotation(qr, width, height);
    if (rotation !== 0) {
      image = await rotate(image, rotation);
      rotatedDegrees = rotation;
      if (rotation !== 180) [width, height] = [height, width];
      // Re-detect so coordinates match the upright image.
      qr = (await findQr(image)) ?? rotateHit(qr, rotation, normalized.width, normalized.height);
    }
  }

  // Light readability pass for the model. Keeps color.
  image = await sharp(image).normalise().jpeg({ quality: JPEG_QUALITY }).toBuffer();

  let headerBlanked = false;
  if (qr) {
    image = await blankHeader(image, qr);
    headerBlanked = true;
  }

  const meta = await sharp(image).metadata();
  return {
    image,
    width: meta.width ?? width,
    height: meta.height ?? height,
    qr,
    rotatedDegrees,
    headerBlanked,
  };
}

/** Maps QR corners through a clockwise rotation of an image of size (w, h). */
function rotateHit(qr: QrHit, degrees: 90 | 180 | 270, w: number, h: number): QrHit {
  const map = (p: { x: number; y: number }) => {
    if (degrees === 90) return { x: h - p.y, y: p.x };
    if (degrees === 180) return { x: w - p.x, y: h - p.y };
    return { x: p.y, y: w - p.x };
  };
  return { text: qr.text, corners: qr.corners.map(map) };
}

/* ------------------------------------------------------------------ */
/* Copier PDFs                                                         */
/* ------------------------------------------------------------------ */

/*
 * PDF rendering uses unpdf (MIT, a serverless build of Mozilla's PDF.js) with
 * @napi-rs/canvas (MIT) as the Node canvas. Both run fully offline: PDF.js is
 * bundled inside unpdf and the canvas is a native module.
 */

type Unpdf = typeof import("unpdf");
let unpdfPromise: Promise<Unpdf> | null = null;

function loadUnpdf(): Promise<Unpdf> {
  if (!unpdfPromise) unpdfPromise = import("unpdf");
  return unpdfPromise;
}

const canvasImport = () => import("@napi-rs/canvas");

/** Opens a PDF. Copies the bytes because PDF.js may take ownership of the buffer it is given. */
async function openPdf(pdf: Buffer) {
  const { getDocumentProxy } = await loadUnpdf();
  return getDocumentProxy(new Uint8Array(pdf));
}

export async function pdfPageCount(pdf: Buffer): Promise<number> {
  const doc = await openPdf(pdf);
  try {
    return doc.numPages;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** Renders each PDF page to a JPEG at ~170 dpi. */
export async function splitPdfToImages(pdf: Buffer, opts?: { dpi?: number; maxPages?: number }): Promise<Buffer[]> {
  const dpi = opts?.dpi ?? 170;
  const { renderPageAsImage } = await loadUnpdf();
  const doc = await openPdf(pdf);
  const images: Buffer[] = [];
  try {
    const count = Math.min(doc.numPages, opts?.maxPages ?? Number.POSITIVE_INFINITY);
    for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
      // Passing the open document (not bytes) keeps it from being re-parsed for every page.
      const png = await renderPageAsImage(doc, pageNumber, { canvasImport, scale: dpi / 72 });
      images.push(
        await sharp(Buffer.from(png)).flatten({ background: "#ffffff" }).jpeg({ quality: JPEG_QUALITY }).toBuffer(),
      );
    }
  } finally {
    await doc.loadingTask.destroy();
  }
  return images;
}
