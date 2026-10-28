ALTER TABLE "strategic_kpi" ADD COLUMN "template_code" varchar(80);--> statement-breakpoint
ALTER TABLE "strategic_objective" ADD COLUMN "template_code" varchar(80);--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_objective_template_unique" ON "strategic_kpi" USING btree ("objective_id","template_code");--> statement-breakpoint
CREATE UNIQUE INDEX "objective_cycle_template_unique" ON "strategic_objective" USING btree ("cycle_id","template_code");