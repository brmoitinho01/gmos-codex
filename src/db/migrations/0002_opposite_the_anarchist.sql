CREATE TABLE "business_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"value" jsonb,
	"unavailable" boolean DEFAULT false NOT NULL,
	"confidence" varchar(20) DEFAULT 'exact' NOT NULL,
	"source_note" varchar(120),
	"reference_date" date,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosis_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"dimension" varchar(40) NOT NULL,
	"quadrant" varchar(20) NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"intensity" varchar(12) DEFAULT 'medium' NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"plan_version_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"actual_value" varchar(80) NOT NULL,
	"target_snapshot" varchar(80),
	"definition_snapshot" jsonb NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"observation" text DEFAULT '' NOT NULL,
	"validation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"validated_by" text,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255),
	"employee_code" varchar(60),
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_position_id" uuid,
	"title" varchar(160) NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"responsibilities" text DEFAULT '' NOT NULL,
	"authority" text DEFAULT '' NOT NULL,
	"deliverables" text DEFAULT '' NOT NULL,
	"expected_holders" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"assignment_type" varchar(20) DEFAULT 'holder' NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"assigned_user_id" text,
	"due_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"observation" text DEFAULT '' NOT NULL,
	"impediment" text DEFAULT '' NOT NULL,
	"completed_by" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"frequency" varchar(24) NOT NULL,
	"responsible_user_id" text,
	"responsible_name" varchar(160),
	"start_date" date NOT NULL,
	"weekday" integer,
	"monthday" integer,
	"custom_interval_days" integer,
	"time_of_day" varchar(5),
	"evidence_required" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_initiative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"kpi_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"expected_result" text DEFAULT '' NOT NULL,
	"owner_name" varchar(160),
	"sponsor_name" varchar(160),
	"start_date" date,
	"due_date" date,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"planned_cost" varchar(60),
	"actual_cost" varchar(60),
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "kpi_id" uuid;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "initiative_id" uuid;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "why" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "how" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "location" varchar(160);--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "result" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "origin" varchar(40) DEFAULT 'objective' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "origin_justification" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "dependencies" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_item" ADD COLUMN "risks" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_fact" ADD CONSTRAINT "business_fact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_fact" ADD CONSTRAINT "business_fact_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_fact" ADD CONSTRAINT "business_fact_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_signal" ADD CONSTRAINT "diagnosis_signal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_signal" ADD CONSTRAINT "diagnosis_signal_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_signal" ADD CONSTRAINT "diagnosis_signal_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_kpi_id_strategic_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."strategic_kpi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_measurement" ADD CONSTRAINT "kpi_measurement_validated_by_user_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_person" ADD CONSTRAINT "organization_person_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_person" ADD CONSTRAINT "organization_person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_position" ADD CONSTRAINT "organization_position_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignment" ADD CONSTRAINT "position_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignment" ADD CONSTRAINT "position_assignment_position_id_organization_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."organization_position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignment" ADD CONSTRAINT "position_assignment_person_id_organization_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."organization_person"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_execution" ADD CONSTRAINT "routine_execution_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_execution" ADD CONSTRAINT "routine_execution_template_id_routine_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."routine_template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_execution" ADD CONSTRAINT "routine_execution_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_execution" ADD CONSTRAINT "routine_execution_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_cycle_id_strategic_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."strategic_cycle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_objective_id_strategic_objective_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objective"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_kpi_id_strategic_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."strategic_kpi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_initiative" ADD CONSTRAINT "strategic_initiative_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_fact_cycle_code_unique" ON "business_fact" USING btree ("cycle_id","code");--> statement-breakpoint
CREATE INDEX "business_fact_org_idx" ON "business_fact" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnosis_signal_cycle_code_unique" ON "diagnosis_signal" USING btree ("cycle_id","code");--> statement-breakpoint
CREATE INDEX "diagnosis_signal_org_idx" ON "diagnosis_signal" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_kpi_period_unique" ON "kpi_measurement" USING btree ("kpi_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "measurement_cycle_idx" ON "kpi_measurement" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "measurement_org_idx" ON "kpi_measurement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_person_org_idx" ON "organization_person" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_position_org_idx" ON "organization_position" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "position_assignment_position_idx" ON "position_assignment" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "position_assignment_person_idx" ON "position_assignment" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_execution_template_due_unique" ON "routine_execution" USING btree ("template_id","due_date");--> statement-breakpoint
CREATE INDEX "routine_execution_assignee_idx" ON "routine_execution" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "routine_template_org_idx" ON "routine_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "initiative_cycle_idx" ON "strategic_initiative" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "initiative_objective_idx" ON "strategic_initiative" USING btree ("objective_id");--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_kpi_id_strategic_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."strategic_kpi"("id") ON DELETE restrict ON UPDATE no action;