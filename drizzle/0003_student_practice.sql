CREATE TABLE "class_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"student_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"prompt_key" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reading_ends_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"draft_text" text DEFAULT '' NOT NULL,
	"draft_seq" integer DEFAULT 0 NOT NULL,
	"draft_saved_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"auto_submitted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission" ALTER COLUMN "assignment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submission" ALTER COLUMN "student_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "join_code" text;--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "context" text DEFAULT 'assignment' NOT NULL;--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "practice_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "kind" text DEFAULT 'teacher' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_membership" ADD CONSTRAINT "class_membership_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempt" ADD CONSTRAINT "practice_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_membership_class_user_uniq" ON "class_membership" USING btree ("class_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_membership_student_uniq" ON "class_membership" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "class_membership_user_idx" ON "class_membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "practice_attempt_user_idx" ON "practice_attempt" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_practice_attempt_id_practice_attempt_id_fk" FOREIGN KEY ("practice_attempt_id") REFERENCES "public"."practice_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_join_code_unique" UNIQUE("join_code");--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_practice_attempt_id_unique" UNIQUE("practice_attempt_id");