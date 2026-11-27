CREATE TABLE "llm_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"route" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"model" text,
	"provider" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"cost_usd" numeric(12, 6),
	"cloud_cost_estimate_usd" numeric(12, 6),
	"worker_id" text,
	"claim_token" uuid,
	"claimed_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "llm_worker" (
	"id" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" text
);
--> statement-breakpoint
CREATE INDEX "llm_jobs_claim_idx" ON "llm_jobs" USING btree ("status","route","created_at");--> statement-breakpoint
CREATE INDEX "llm_jobs_completed_idx" ON "llm_jobs" USING btree ("completed_at");