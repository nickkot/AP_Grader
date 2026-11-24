ALTER TABLE "class" ADD COLUMN "roster_kind" text DEFAULT 'names' NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "student_class_number_idx" ON "student" USING btree ("class_id","number");