CREATE TABLE "action_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner_name" varchar(160),
	"due_date" date,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"planned_cost" varchar(60),
	"actual_cost" varchar(60),
	"progress" integer DEFAULT 0 NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"source_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"phase" varchar(32) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questionnaire_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"questionnaire_code" varchar(40) NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_kpi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"definition" text DEFAULT '' NOT NULL,
	"unit" varchar(40) NOT NULL,
	"source" varchar(160) NOT NULL,
	"periodicity" varchar(40) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"formula" text NOT NULL,
	"baseline" varchar(60),
	"target" varchar(60),
	"owner_name" varchar(160),
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"perspective" varchar(60),
	"owner_name" varchar(160),
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "workflow_status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "technical_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "technical_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD COLUMN "official_version_id" text;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_objective_id_strategic_objective_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objective"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_section" ADD CONSTRAINT "planning_section_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_section" ADD CONSTRAINT "planning_section_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_section" ADD CONSTRAINT "planning_section_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_response" ADD CONSTRAINT "questionnaire_response_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_response" ADD CONSTRAINT "questionnaire_response_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_response" ADD CONSTRAINT "questionnaire_response_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_kpi" ADD CONSTRAINT "strategic_kpi_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_kpi" ADD CONSTRAINT "strategic_kpi_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_kpi" ADD CONSTRAINT "strategic_kpi_objective_id_strategic_objective_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objective"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_kpi" ADD CONSTRAINT "strategic_kpi_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objective" ADD CONSTRAINT "strategic_objective_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objective" ADD CONSTRAINT "strategic_objective_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objective" ADD CONSTRAINT "strategic_objective_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_cycle_idx" ON "action_item" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "action_objective_idx" ON "action_item" USING btree ("objective_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_version_cycle_number_unique" ON "plan_version" USING btree ("cycle_id","version_number");--> statement-breakpoint
CREATE INDEX "plan_version_org_idx" ON "plan_version" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_section_cycle_phase_unique" ON "planning_section" USING btree ("cycle_id","phase");--> statement-breakpoint
CREATE INDEX "planning_section_org_idx" ON "planning_section" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_cycle_code_unique" ON "questionnaire_response" USING btree ("cycle_id","questionnaire_code");--> statement-breakpoint
CREATE INDEX "questionnaire_org_idx" ON "questionnaire_response" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kpi_cycle_idx" ON "strategic_kpi" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "kpi_objective_idx" ON "strategic_kpi" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "objective_cycle_idx" ON "strategic_objective" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "objective_org_idx" ON "strategic_objective" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD CONSTRAINT "strategic_cycle_technical_reviewed_by_user_id_fk" FOREIGN KEY ("technical_reviewed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_cycle" ADD CONSTRAINT "strategic_cycle_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;