import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth tables (shape required by Better Auth)                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* Classes and rosters                                                 */
/* ------------------------------------------------------------------ */

export const courseEnum = pgEnum("course", ["APUSH", "AP_LANG"]);
export const essayTypeEnum = pgEnum("essay_type", ["APUSH_DBQ", "LANG_ARG"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const classes = pgTable(
  "class",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    course: courseEnum("course").notNull(),
    name: text("name").notNull(),
    /** "numbers": students are listed as Student 1, Student 2, and no names are stored. */
    rosterKind: text("roster_kind", { enum: ["names", "numbers"] }).notNull().default("names"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("class_teacher_idx").on(t.teacherId)],
);

export const students = pgTable(
  "student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Empty in a numbered class. */
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    /** Set in a numbered class: the student is shown as "Student {number}". */
    number: integer("number"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("student_class_idx").on(t.classId), uniqueIndex("student_class_number_idx").on(t.classId, t.number)],
);

/* ------------------------------------------------------------------ */
/* Assignments and packets                                             */
/* ------------------------------------------------------------------ */

export type SourceDocument = {
  number: number;
  citation: string;
  text: string;
};

export const assignmentStatusEnum = pgEnum("assignment_status", ["open", "closed"]);

export const assignments = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    essayType: essayTypeEnum("essay_type").notNull(),
    title: text("title").notNull(),
    promptText: text("prompt_text").notNull(),
    sources: jsonb("sources").$type<SourceDocument[]>().notNull().default([]),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    readingMinutes: integer("reading_minutes").notNull().default(0),
    answerPagesPerStudent: integer("answer_pages_per_student").notNull().default(4),
    rubricKey: text("rubric_key").notNull(),
    rubricVersion: integer("rubric_version").notNull(),
    status: assignmentStatusEnum("status").notNull().default("open"),
    /** Set when the first essay is scored. Prompt, sources and rubric are locked after this. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("assignment_teacher_idx").on(t.teacherId), index("assignment_class_idx").on(t.classId)],
);

/**
 * Opaque QR token printed on each answer page. Encodes nothing about the
 * student: the link from token to student only exists in this table.
 */
export const qrTokens = pgTable(
  "qr_token",
  {
    token: text("token").primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Null for spare sheets: the student writes their name and the teacher matches it. */
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    pageCount: integer("page_count").notNull(),
    /** Spare sheets share a set number so their pages can be grouped. */
    spareSet: integer("spare_set"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("qr_assignment_idx").on(t.assignmentId),
    uniqueIndex("qr_student_page_uniq")
      .on(t.assignmentId, t.studentId, t.pageNumber)
      .where(sql`${t.studentId} is not null`),
  ],
);

/* ------------------------------------------------------------------ */
/* Submissions, pages and transcriptions                               */
/* ------------------------------------------------------------------ */

export const inputKindEnum = pgEnum("input_kind", ["handwritten", "typed"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "transcribing",
  "needs_confirmation",
  "scoring",
  "scored",
  "approved",
  "failed",
]);

export const submissions = pgTable(
  "submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    inputKind: inputKindEnum("input_kind").notNull(),
    status: submissionStatusEnum("status").notNull(),
    typedText: text("typed_text"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by").references(() => user.id),
    error: text("error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("submission_assignment_student_uniq").on(t.assignmentId, t.studentId)],
);

/**
 * A short-lived link, shown as a QR code on the teacher's computer, that lets their phone
 * upload page photos to one assignment without signing in. It can only add pages: it
 * cannot read essays, scores or the roster.
 */
export const phoneLinks = pgTable(
  "phone_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 of the token in the link. The token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("phone_link_assignment_idx").on(t.assignmentId)],
);

export const uploadBatches = pgTable("upload_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id),
  /** Set when the photos came from a phone through a phone link. */
  phoneLinkId: uuid("phone_link_id").references(() => phoneLinks.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["photos", "pdf"] }).notNull(),
  /** For PDF uploads: the original file, split into pages by a background job. */
  pdfKey: text("pdf_key"),
  status: text("status", { enum: ["processing", "done", "failed"] })
    .notNull()
    .default("processing"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TranscriptWord = {
  text: string;
  confidence: number;
  /** Crossed out by the student. Kept for the record, never scored. */
  deleted?: boolean;
  /** Could not be read. Shown to the teacher as a gap, never guessed. */
  illegible?: boolean;
};

export type TranscriptLine = { words: TranscriptWord[] };

export const pageStatusEnum = pgEnum("page_status", [
  "uploaded",
  "processing",
  "unmatched",
  "transcribing",
  "transcribed",
  "failed",
]);

export const pages = pgTable(
  "page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "set null" }),
    uploadBatchId: uuid("upload_batch_id").references(() => uploadBatches.id, { onDelete: "set null" }),
    pageNumber: integer("page_number"),
    qrToken: text("qr_token"),
    matchMethod: text("match_method", { enum: ["qr", "manual", "typed"] }),
    /** The photo as uploaded. Kept as the record of authenticity. */
    originalKey: text("original_key").notNull(),
    /** Rotated, normalized, header blanked. This is what the model sees. */
    processedKey: text("processed_key"),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    status: pageStatusEnum("status").notNull().default("uploaded"),
    error: text("error"),

    transcriptionModel: text("transcription_model"),
    transcriptionPromptVersion: text("transcription_prompt_version"),
    transcript: jsonb("transcript").$type<TranscriptLine[]>(),
    draftText: text("draft_text"),
    confirmedText: text("confirmed_text"),
    meanConfidence: real("mean_confidence"),
    lowConfidenceCount: integer("low_confidence_count"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("page_assignment_idx").on(t.assignmentId),
    index("page_submission_idx").on(t.submissionId),
    index("page_batch_idx").on(t.uploadBatchId),
  ],
);

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export type Evidence = {
  quote: string;
  /** True when the quote was found verbatim in the essay text. */
  verified: boolean;
  /** Character offsets in the essay text, when verified. */
  start?: number;
  end?: number;
  /** Page the quote is on, for handwritten essays. */
  pageId?: string;
  pageNumber?: number;
};

export const scoreRunStatusEnum = pgEnum("score_run_status", ["running", "completed", "failed", "canceled"]);

export const scoreRuns = pgTable(
  "score_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    rubricKey: text("rubric_key").notNull(),
    rubricVersion: integer("rubric_version").notNull(),
    essayTextSha256: text("essay_text_sha256").notNull(),
    status: scoreRunStatusEnum("status").notNull().default("running"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5 }).notNull().default("0"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("score_run_submission_idx").on(t.submissionId)],
);

export const rowReviewStatusEnum = pgEnum("row_review_status", ["pending", "accepted", "adjusted"]);

export const rowScores = pgTable(
  "row_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scoreRunId: uuid("score_run_id")
      .notNull()
      .references(() => scoreRuns.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    rowKey: text("row_key").notNull(),
    maxPoints: integer("max_points").notNull(),
    /** What the model awarded. Never changed after scoring. */
    aiPoints: integer("ai_points"),
    /** Current points: the model's, or the teacher's adjustment. */
    points: integer("points"),
    justification: text("justification").notNull().default(""),
    aiStudentFeedback: text("ai_student_feedback").notNull().default(""),
    studentFeedback: text("student_feedback").notNull().default(""),
    confidence: real("confidence"),
    evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
    flags: text("flags").array().notNull().default(sql`'{}'::text[]`),
    reviewStatus: rowReviewStatusEnum("review_status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("row_score_submission_idx").on(t.submissionId),
    uniqueIndex("row_score_run_row_uniq").on(t.scoreRunId, t.rowKey),
  ],
);

export const reviewActions = pgTable(
  "review_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rowScoreId: uuid("row_score_id")
      .notNull()
      .references(() => rowScores.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    action: text("action", { enum: ["accept", "adjust_points", "edit_feedback"] }).notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_action_row_idx").on(t.rowScoreId)],
);

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export const auditEvents = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_resource_idx").on(t.resourceType, t.resourceId), index("audit_user_idx").on(t.userId)],
);
