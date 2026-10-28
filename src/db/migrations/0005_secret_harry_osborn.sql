CREATE TABLE "ai_assistance_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"mode" varchar(40) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_version" varchar(40) NOT NULL,
	"context_hash" varchar(64) NOT NULL,
	"context_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"category" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"recommendation" text NOT NULL,
	"rationale" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assistance_run" ADD CONSTRAINT "ai_assistance_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assistance_run" ADD CONSTRAINT "ai_assistance_run_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assistance_run" ADD CONSTRAINT "ai_assistance_run_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_run_id_ai_assistance_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_assistance_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_org_cycle_idx" ON "ai_assistance_run" USING btree ("organization_id","cycle_id");--> statement-breakpoint
CREATE INDEX "ai_run_requester_idx" ON "ai_assistance_run" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "ai_suggestion_run_idx" ON "ai_suggestion" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_suggestion_org_cycle_idx" ON "ai_suggestion" USING btree ("organization_id","cycle_id");