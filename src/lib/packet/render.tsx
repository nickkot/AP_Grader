import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

export type PacketSheet = {
  token: string;
  studentName: string | null;
  pageNumber: number;
  pageCount: number;
  spareSet?: number;
};

export type PacketInput = {
  /** QR codes encode `${appUrl}/q/${token}`. */
  appUrl: string;
  className: string;
  courseLabel: string;
  assignmentTitle: string;
  essayTypeLabel: string;
  promptText: string;
  sources: { number: number; citation: string; text: string }[];
  timeLimitMinutes: number;
  readingMinutes: number;
  rubricRows: { label: string; maxPoints: number; studentWording: string }[];
  /** Already in print order. Spare sheets have studentName null. */
  sheets: PacketSheet[];
  paperSize: "LETTER" | "A4";
  /** Adds blank pages so the answer pages and each student's set start on a front side. */
  doubleSided: boolean;
};

// Never hyphenate words: rubric labels and names must stay whole.
Font.registerHyphenationCallback((word) => [word]);

/* ------------------------------------------------------------------ */
/* Geometry (PDF points, 72 per inch)                                  */
/* ------------------------------------------------------------------ */

const IN = 72;
const MARGIN = 0.6 * IN;
const QR_SIZE = 0.85 * IN;
/** Padding inside the header box around the QR code. */
const HEADER_PAD = 6;
const HEADER_HEIGHT = QR_SIZE + HEADER_PAD * 2;
const LINE_SPACING = 0.33 * IN;
const FOOTER_HEIGHT = 24;

const PAGE_HEIGHT = { LETTER: 11 * IN, A4: 841.89 } as const;

/** Exposed for the image pipeline and tests: where the header box ends, from the page top, in points. */
export const ANSWER_SHEET_LAYOUT = {
  marginPt: MARGIN,
  qrSizePt: QR_SIZE,
  headerTopPt: MARGIN,
  headerBottomPt: MARGIN + HEADER_HEIGHT,
  qrTopLeftPt: { x: MARGIN + HEADER_PAD, y: MARGIN + HEADER_PAD },
} as const;

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const INK = "#111111";
const MUTED = "#555555";
const RULE = "#9a9a9a";
const LINE = "#b3b3b3";

const s = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.45,
    color: INK,
  },
  eyebrow: { fontSize: 9, color: MUTED, marginBottom: 4 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, lineHeight: 1.25, marginBottom: 10 },
  metaRow: { flexDirection: "row", gap: 18, marginBottom: 14 },
  metaItem: { fontSize: 10 },
  metaLabel: { fontFamily: "Helvetica-Bold" },
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
  },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  prompt: { fontFamily: "Times-Roman", fontSize: 12.5, lineHeight: 1.5 },
  rubricRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#d6d6d6" },
  rubricLabel: { width: 180, paddingRight: 8, fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  rubricPoints: { width: 56, fontSize: 10.5, color: MUTED },
  rubricText: { flex: 1, fontSize: 10.5 },
  docBlock: { marginBottom: 18 },
  docHeading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 2 },
  docCitation: { fontSize: 9.5, color: MUTED, marginBottom: 6 },
  docText: { fontFamily: "Times-Roman", fontSize: 11.5, lineHeight: 1.5 },
  blankNote: { marginTop: 300, textAlign: "center", fontSize: 9, color: MUTED },

  // Answer sheet
  headerBox: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: RULE,
    borderRadius: 3,
    padding: HEADER_PAD,
  },
  qr: { width: QR_SIZE, height: QR_SIZE },
  headerText: { flex: 1, marginLeft: 12, justifyContent: "space-between", height: QR_SIZE },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  studentName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    lineHeight: 1.2,
    flex: 1,
    marginRight: 12,
    maxLines: 1,
    textOverflow: "ellipsis",
  },
  /** Long names shrink and may wrap once, so the last name stays visible for matching. */
  studentNameLong: { fontSize: 11, lineHeight: 1.15, maxLines: 2 },
  nameLine: { flexDirection: "row", alignItems: "flex-end", flex: 1, marginRight: 12 },
  nameLabel: { fontFamily: "Helvetica-Bold", fontSize: 12, marginRight: 4 },
  nameBlank: { flex: 1, borderBottomWidth: 0.75, borderBottomColor: INK, height: 16 },
  pageOf: { fontFamily: "Helvetica-Bold", fontSize: 12, lineHeight: 1.2 },
  headerDetail: { fontSize: 9, lineHeight: 1.3, color: MUTED, maxLines: 1, textOverflow: "ellipsis" },
  headerCode: { fontFamily: "Courier", fontSize: 8, color: MUTED },
  lines: { marginTop: LINE_SPACING * 0.5 },
  line: { height: LINE_SPACING, borderBottomWidth: 0.6, borderBottomColor: LINE },
  footer: {
    marginTop: 8,
    fontSize: 8.5,
    lineHeight: 1.2,
    color: MUTED,
    textAlign: "center",
  },
});

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function timeLine(timeLimitMinutes: number, readingMinutes: number): string {
  if (readingMinutes > 0) {
    return `${timeLimitMinutes} minutes, including a ${readingMinutes}-minute reading period`;
  }
  return `${timeLimitMinutes} minutes`;
}

function pointsLabel(points: number): string {
  return points === 1 ? "1 point" : `${points} points`;
}

function instructions(input: PacketInput): string[] {
  const lines: string[] = [];
  if (input.readingMinutes > 0) {
    lines.push(`Use the first ${input.readingMinutes} minutes to read the documents and plan. You may write notes on the prompt pages.`);
  }
  lines.push("Write your essay on the lined answer pages. Use a pen or dark pencil.");
  lines.push("Write only inside the lines. Keep the box at the top of each page clear.");
  lines.push("Cross out anything you do not want read. Crossed-out writing is not scored.");
  lines.push("Need more room? Ask for a spare sheet and write your name on it.");
  return lines;
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function PromptSection({ input }: { input: PacketInput }) {
  const totalPoints = input.rubricRows.reduce((sum, r) => sum + r.maxPoints, 0);
  return (
    <Page size={input.paperSize} style={s.page} wrap>
      <Text style={s.eyebrow}>
        {input.courseLabel}, {input.essayTypeLabel}, {input.className}
      </Text>
      <Text style={s.title}>{input.assignmentTitle}</Text>
      <View style={s.metaRow}>
        <Text style={s.metaItem}>
          <Text style={s.metaLabel}>Time: </Text>
          {timeLine(input.timeLimitMinutes, input.readingMinutes)}
        </Text>
        <Text style={s.metaItem}>
          <Text style={s.metaLabel}>Score: </Text>
          {pointsLabel(totalPoints)}
        </Text>
      </View>

      <Text style={s.sectionHeading}>Instructions</Text>
      {instructions(input).map((line, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletMark}>-</Text>
          <Text style={s.bulletText}>{line}</Text>
        </View>
      ))}

      <Text style={s.sectionHeading}>Prompt</Text>
      {input.promptText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((paragraph, i) => (
          <Text key={i} style={[s.prompt, { marginBottom: 8 }]}>
            {paragraph}
          </Text>
        ))}

      <View wrap={false}>
        <Text style={s.sectionHeading}>How this is scored</Text>
        {input.rubricRows.map((row, i) => (
          <View key={i} style={s.rubricRow}>
            <Text style={s.rubricLabel}>{row.label}</Text>
            <Text style={s.rubricPoints}>{pointsLabel(row.maxPoints)}</Text>
            <Text style={s.rubricText}>{row.studentWording}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

function SourcesSection({ input }: { input: PacketInput }) {
  if (input.sources.length === 0) return null;
  const sorted = [...input.sources].sort((a, b) => a.number - b.number);
  return (
    <Page size={input.paperSize} style={s.page} wrap>
      <Text style={s.eyebrow}>
        {input.assignmentTitle}, {input.className}
      </Text>
      <Text style={s.title}>Documents</Text>
      {sorted.map((doc) => (
        <View key={doc.number} style={s.docBlock} wrap={doc.text.length > 1800} minPresenceAhead={80}>
          <Text style={s.docHeading}>Document {doc.number}</Text>
          {doc.citation ? <Text style={s.docCitation}>{doc.citation}</Text> : null}
          {doc.text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((paragraph, i) => (
              <Text key={i} style={[s.docText, { marginBottom: 6 }]}>
                {paragraph}
              </Text>
            ))}
        </View>
      ))}
    </Page>
  );
}

function BlankPage({ paperSize }: { paperSize: PacketInput["paperSize"] }) {
  return (
    <Page size={paperSize} style={s.page}>
      <Text style={s.blankNote}>This page is left blank.</Text>
    </Page>
  );
}

function lineCount(paperSize: PacketInput["paperSize"]): number {
  const usable = PAGE_HEIGHT[paperSize] - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT - LINE_SPACING * 0.5;
  return Math.floor(usable / LINE_SPACING);
}

function AnswerSheet({
  input,
  sheet,
  qrDataUrl,
}: {
  input: PacketInput;
  sheet: PacketSheet;
  qrDataUrl: string;
}) {
  const lines = lineCount(input.paperSize);
  return (
    <Page size={input.paperSize} style={s.page} wrap={false}>
      <View style={s.headerBox}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        <Image src={qrDataUrl} style={s.qr} />
        <View style={s.headerText}>
          <View style={s.headerTopRow}>
            {sheet.studentName ? (
              <Text style={sheet.studentName.length > 30 ? [s.studentName, s.studentNameLong] : s.studentName}>
                {sheet.studentName}
              </Text>
            ) : (
              <View style={s.nameLine}>
                <Text style={s.nameLabel}>Name:</Text>
                <View style={s.nameBlank} />
              </View>
            )}
            <Text style={s.pageOf}>
              Page {sheet.pageNumber} of {sheet.pageCount}
            </Text>
          </View>
          <View>
            <Text style={s.headerDetail}>
              {input.className}, {input.assignmentTitle}
            </Text>
            <Text style={s.headerCode}>
              {sheet.studentName ? "Sheet" : `Spare sheet set ${sheet.spareSet ?? 1}`} {sheet.token}
            </Text>
          </View>
        </View>
      </View>
      <View style={s.lines}>
        {Array.from({ length: lines }, (_, i) => (
          <View key={i} style={s.line} />
        ))}
      </View>
      <Text style={s.footer}>Write only inside the lines. Do not write in the box above.</Text>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function qrUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/q/${token}`;
}

async function qrDataUrls(input: PacketInput): Promise<Map<string, string>> {
  const entries = await Promise.all(
    input.sheets.map(
      async (sheet) =>
        [
          sheet.token,
          await QRCode.toDataURL(qrUrl(input.appUrl, sheet.token), {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 360,
            color: { dark: "#000000", light: "#ffffff" },
          }),
        ] as const,
    ),
  );
  return new Map(entries);
}

/** Counts pages in a PDF produced by react-pdf (pdfkit writes page dictionaries uncompressed). */
function countPdfPages(pdf: Buffer): number {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g);
  return matches ? matches.length : 0;
}

function FrontMatter({ input }: { input: PacketInput }) {
  return (
    <>
      <PromptSection input={input} />
      <SourcesSection input={input} />
    </>
  );
}

/** A student's set ends at its last page; spare sets end where the next set begins. */
function isEndOfSet(sheets: PacketSheet[], index: number): boolean {
  const sheet = sheets[index];
  const next = sheets[index + 1];
  if (!next) return true;
  if (sheet.pageNumber === sheet.pageCount) return true;
  return next.pageNumber <= sheet.pageNumber;
}

export async function renderPacketPdf(input: PacketInput): Promise<Buffer> {
  const qrs = await qrDataUrls(input);

  let padFrontMatter = false;
  if (input.doubleSided) {
    const front = await renderToBuffer(
      <Document>
        <FrontMatter input={input} />
      </Document>,
    );
    padFrontMatter = countPdfPages(front) % 2 === 1;
  }

  const answerPages: React.ReactElement[] = [];
  let setLength = 0;
  input.sheets.forEach((sheet, i) => {
    answerPages.push(<AnswerSheet key={`${sheet.token}-${i}`} input={input} sheet={sheet} qrDataUrl={qrs.get(sheet.token)!} />);
    setLength++;
    if (isEndOfSet(input.sheets, i)) {
      if (input.doubleSided && setLength % 2 === 1) {
        answerPages.push(<BlankPage key={`blank-${sheet.token}-${i}`} paperSize={input.paperSize} />);
      }
      setLength = 0;
    }
  });

  return renderToBuffer(
    <Document title={`${input.assignmentTitle}, ${input.className}`} creator="Essay grader" producer="Essay grader">
      <FrontMatter input={input} />
      {padFrontMatter ? <BlankPage paperSize={input.paperSize} /> : null}
      {answerPages}
    </Document>,
  );
}
