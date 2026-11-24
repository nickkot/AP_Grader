CREATE TABLE "phone_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"assignment_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "upload_batch" ADD COLUMN "phone_link_id" uuid;--> statement-breakpoint
ALTER TABLE "phone_link" ADD CONSTRAINT "phone_link_assignment_id_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_link" ADD CONSTRAINT "phone_link_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_link_assignment_idx" ON "phone_link" USING btree ("assignment_id");--> statement-breakpoint
ALTER TABLE "upload_batch" ADD CONSTRAINT "upload_batch_phone_link_id_phone_link_id_fk" FOREIGN KEY ("phone_link_id") REFERENCES "public"."phone_link"("id") ON DELETE set null ON UPDATE no action;