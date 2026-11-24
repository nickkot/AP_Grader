CREATE TYPE "public"."assignment_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."course" AS ENUM('APUSH', 'AP_LANG');--> statement-breakpoint
CREATE TYPE "public"."essay_type" AS ENUM('APUSH_DBQ', 'LANG_ARG');--> statement-breakpoint
CREATE TYPE "public"."input_kind" AS ENUM('handwritten', 'typed');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('uploaded', 'processing', 'unmatched', 'transcribing', 'transcribed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."row_review_status" AS ENUM('pending', 'accepted', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."score_run_status" AS ENUM('running', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('transcribing', 'needs_confirmation', 'scoring', 'scored', 'approved', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"class_id" uuid NOT NULL,
	"essay_type" "essay_type" NOT NULL,
	"title" text NOT NULL,
	"prompt_text" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_limit_minutes" integer NOT NULL,
	"reading_minutes" integer DEFAULT 0 NOT NULL,
	"answer_pages_per_student" integer DEFAULT 4 NOT NULL,
	"rubric_key" text NOT NULL,
	"rubric_version" integer NOT NULL,
	"status" "assignment_status" DEFAULT 'open' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"course" "course" NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"submission_id" uuid,
	"upload_batch_id" uuid,
	"page_number" integer,
	"qr_token" text,
	"match_method" text,
	"original_key" text NOT NULL,
	"processed_key" text,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "page_status" DEFAULT 'uploaded' NOT NULL,
	"error" text,
	"transcription_model" text,
	"transcription_prompt_version" text,
	"transcript" jsonb,
	"draft_text" text,
	"confirmed_text" text,
	"mean_confidence" real,
	"low_confidence_count" integer,
	"transcribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_token" (
	"token" text PRIMARY KEY NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid,
	"page_number" integer NOT NULL,
	"page_count" integer NOT NULL,
	"spare_set" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_score_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "row_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score_run_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"row_key" text NOT NULL,
	"max_points" integer NOT NULL,
	"ai_points" integer,
	"points" integer,
	"justification" text DEFAULT '' NOT NULL,
	"ai_student_feedback" text DEFAULT '' NOT NULL,
	"student_feedback" text DEFAULT '' NOT NULL,
	"confidence" real,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"review_status" "row_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"rubric_key" text NOT NULL,
	"rubric_version" integer NOT NULL,
	"essay_text_sha256" text NOT NULL,
	"status" "score_run_status" DEFAULT 'running' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 5) DEFAULT '0' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"input_kind" "input_kind" NOT NULL,
	"status" "submission_status" NOT NULL,
	"typed_text" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"kind" text NOT NULL,
	"pdf_key" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_upload_batch_id_upload_batch_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_token" ADD CONSTRAINT "qr_token_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_token" ADD CONSTRAINT "qr_token_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_action" ADD CONSTRAINT "review_action_row_score_id_row_score_id_fk" FOREIGN KEY ("row_score_id") REFERENCES "public"."row_score"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_action" ADD CONSTRAINT "review_action_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_score" ADD CONSTRAINT "row_score_score_run_id_score_run_id_fk" FOREIGN KEY ("score_run_id") REFERENCES "public"."score_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_score" ADD CONSTRAINT "row_score_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_score" ADD CONSTRAINT "row_score_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_run" ADD CONSTRAINT "score_run_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batch" ADD CONSTRAINT "upload_batch_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batch" ADD CONSTRAINT "upload_batch_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "assignment_teacher_idx" ON "assignment" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "assignment_class_idx" ON "assignment" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_event" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "class_teacher_idx" ON "class" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "page_assignment_idx" ON "page" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "page_submission_idx" ON "page" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "page_batch_idx" ON "page" USING btree ("upload_batch_id");--> statement-breakpoint
CREATE INDEX "qr_assignment_idx" ON "qr_token" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_student_page_uniq" ON "qr_token" USING btree ("assignment_id","student_id","page_number") WHERE "qr_token"."student_id" is not null;--> statement-breakpoint
CREATE INDEX "review_action_row_idx" ON "review_action" USING btree ("row_score_id");--> statement-breakpoint
CREATE INDEX "row_score_submission_idx" ON "row_score" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "row_score_run_row_uniq" ON "row_score" USING btree ("score_run_id","row_key");--> statement-breakpoint
CREATE INDEX "score_run_submission_idx" ON "score_run" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "student_class_idx" ON "student" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_assignment_student_uniq" ON "submission" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");