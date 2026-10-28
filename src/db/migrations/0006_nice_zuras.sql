CREATE TABLE "ai_suggestion_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"application_kind" varchar(24) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_revision" integer NOT NULL,
	"opened_revision" boolean DEFAULT false NOT NULL,
	"applied_by" text NOT NULL,
	"application_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_suggestion_application_suggestion_id_unique" UNIQUE("suggestion_id")
);
--> statement-breakpoint
ALTER TABLE "ai_suggestion_application" ADD CONSTRAINT "ai_suggestion_application_suggestion_id_ai_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."ai_suggestion"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion_application" ADD CONSTRAINT "ai_suggestion_application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion_application" ADD CONSTRAINT "ai_suggestion_application_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion_application" ADD CONSTRAINT "ai_suggestion_application_applied_by_user_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_application_org_cycle_idx" ON "ai_suggestion_application" USING btree ("organization_id","cycle_id");--> statement-breakpoint
CREATE INDEX "ai_application_entity_idx" ON "ai_suggestion_application" USING btree ("entity_type","entity_id");