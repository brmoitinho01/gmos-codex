import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", [
  "group_admin",
  "organization_admin",
  "manager",
  "consultant",
  "collaborator",
  "viewer",
]);
export const cycleStatusEnum = pgEnum("cycle_status", ["draft", "active", "closed"]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_idx").on(table.userId)]);

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("account_user_idx").on(table.userId),
  uniqueIndex("account_provider_unique").on(table.providerId, table.accountId),
]);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const userProfiles = pgTable("user_profile", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = pgTable("organization", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  isGroupCompany: boolean("is_group_company").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companies = pgTable("company", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  isRoot: boolean("is_root").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("company_org_name_unique").on(table.organizationId, table.name)]);

export const businessUnits = pgTable("business_unit", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("unit_company_name_unique").on(table.companyId, table.name)]);

export const departments = pgTable("department", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  businessUnitId: uuid("business_unit_id").notNull().references(() => businessUnits.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable("membership", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  assignedBy: text("assigned_by").references(() => users.id, { onDelete: "restrict" }),
  assignmentJustification: text("assignment_justification").default("").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: text("revoked_by").references(() => users.id, { onDelete: "restrict" }),
  revocationReason: text("revocation_reason").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.organizationId] }),
  index("membership_org_idx").on(table.organizationId),
]);

export const invitations = pgTable("invitation", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: roleEnum("role").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  justification: text("justification").notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedBy: text("invited_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "restrict" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("invitation_org_idx").on(table.organizationId), index("invitation_email_idx").on(table.email)]);

export const strategicCycles = pgTable("strategic_cycle", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  status: cycleStatusEnum("status").default("draft").notNull(),
  workflowStatus: varchar("workflow_status", { length: 32 }).default("draft").notNull(),
  revision: integer("revision").default(0).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  technicalReviewedAt: timestamp("technical_reviewed_at", { withTimezone: true }),
  technicalReviewedBy: text("technical_reviewed_by").references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "restrict" }),
  officialVersionId: text("official_version_id"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("cycle_org_name_unique").on(table.organizationId, table.name),
  index("cycle_org_idx").on(table.organizationId),
]);

export const planningSections = pgTable("planning_section", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  phase: varchar("phase", { length: 32 }).notNull(),
  data: jsonb("data").default({}).notNull(),
  completed: boolean("completed").default(false).notNull(),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("planning_section_cycle_phase_unique").on(table.cycleId, table.phase),
  index("planning_section_org_idx").on(table.organizationId),
]);

export const questionnaireResponses = pgTable("questionnaire_response", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  questionnaireCode: varchar("questionnaire_code", { length: 40 }).notNull(),
  answers: jsonb("answers").default({}).notNull(),
  result: jsonb("result").default({}).notNull(),
  completed: boolean("completed").default(false).notNull(),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("questionnaire_cycle_code_unique").on(table.cycleId, table.questionnaireCode),
  index("questionnaire_org_idx").on(table.organizationId),
]);

export const strategicObjectives = pgTable("strategic_objective", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  templateCode: varchar("template_code", { length: 80 }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").default("").notNull(),
  perspective: varchar("perspective", { length: 60 }),
  ownerName: varchar("owner_name", { length: 160 }),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 24 }).default("draft").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("objective_cycle_idx").on(table.cycleId), index("objective_org_idx").on(table.organizationId), uniqueIndex("objective_cycle_template_unique").on(table.cycleId, table.templateCode)]);

export const strategicKpis = pgTable("strategic_kpi", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  objectiveId: uuid("objective_id").notNull().references(() => strategicObjectives.id, { onDelete: "restrict" }),
  templateCode: varchar("template_code", { length: 80 }),
  name: varchar("name", { length: 200 }).notNull(),
  definition: text("definition").default("").notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  source: varchar("source", { length: 160 }).notNull(),
  periodicity: varchar("periodicity", { length: 40 }).notNull(),
  direction: varchar("direction", { length: 20 }).notNull(),
  formula: text("formula").notNull(),
  baseline: varchar("baseline", { length: 60 }),
  target: varchar("target", { length: 60 }),
  ownerName: varchar("owner_name", { length: 160 }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("kpi_cycle_idx").on(table.cycleId), index("kpi_objective_idx").on(table.objectiveId), uniqueIndex("kpi_objective_template_unique").on(table.objectiveId, table.templateCode)]);

export const actionItems = pgTable("action_item", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  objectiveId: uuid("objective_id").notNull().references(() => strategicObjectives.id, { onDelete: "restrict" }),
  kpiId: uuid("kpi_id").references(() => strategicKpis.id, { onDelete: "restrict" }),
  initiativeId: uuid("initiative_id"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").default("").notNull(),
  why: text("why").default("").notNull(),
  how: text("how").default("").notNull(),
  location: varchar("location", { length: 160 }),
  ownerName: varchar("owner_name", { length: 160 }),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  status: varchar("status", { length: 24 }).default("draft").notNull(),
  plannedCost: varchar("planned_cost", { length: 60 }),
  actualCost: varchar("actual_cost", { length: 60 }),
  progress: integer("progress").default(0).notNull(),
  evidence: text("evidence").default("").notNull(),
  result: text("result").default("").notNull(),
  origin: varchar("origin", { length: 40 }).default("objective").notNull(),
  originJustification: text("origin_justification").default("").notNull(),
  dependencies: text("dependencies").default("").notNull(),
  risks: text("risks").default("").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("action_cycle_idx").on(table.cycleId), index("action_objective_idx").on(table.objectiveId)]);

export const planVersions = pgTable("plan_version", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  sourceRevision: integer("source_revision").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  approvedBy: text("approved_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("plan_version_cycle_number_unique").on(table.cycleId, table.versionNumber),
  index("plan_version_org_idx").on(table.organizationId),
]);

export const businessPortraits = pgTable("business_portrait", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  businessDescription: text("business_description").default("").notNull(),
  primaryCustomer: text("primary_customer").default("").notNull(),
  valueProposition: text("value_proposition").default("").notNull(),
  mainChallenge: text("main_challenge").default("").notNull(),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("portrait_cycle_unique").on(table.cycleId),
  index("portrait_org_idx").on(table.organizationId),
]);

export const businessFacts = pgTable("business_fact", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 80 }).notNull(),
  value: jsonb("value"),
  unavailable: boolean("unavailable").default(false).notNull(),
  confidence: varchar("confidence", { length: 20 }).default("exact").notNull(),
  sourceNote: varchar("source_note", { length: 120 }),
  referenceDate: date("reference_date"),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("business_fact_cycle_code_unique").on(table.cycleId, table.code), index("business_fact_org_idx").on(table.organizationId)]);

export const diagnosisSignals = pgTable("diagnosis_signal", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 80 }).notNull(),
  dimension: varchar("dimension", { length: 40 }).notNull(),
  quadrant: varchar("quadrant", { length: 20 }).notNull(),
  selected: boolean("selected").default(false).notNull(),
  intensity: varchar("intensity", { length: 12 }).default("medium").notNull(),
  justification: text("justification").default("").notNull(),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("diagnosis_signal_cycle_code_unique").on(table.cycleId, table.code), index("diagnosis_signal_org_idx").on(table.organizationId)]);

export const kpiMeasurements = pgTable("kpi_measurement", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  kpiId: uuid("kpi_id").notNull().references(() => strategicKpis.id, { onDelete: "restrict" }),
  planVersionId: uuid("plan_version_id").references(() => planVersions.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  actualValue: varchar("actual_value", { length: 80 }).notNull(),
  targetSnapshot: varchar("target_snapshot", { length: 80 }),
  definitionSnapshot: jsonb("definition_snapshot").notNull(),
  evidence: text("evidence").default("").notNull(),
  observation: text("observation").default("").notNull(),
  validationStatus: varchar("validation_status", { length: 20 }).default("pending").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  validatedBy: text("validated_by").references(() => users.id, { onDelete: "restrict" }),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("measurement_kpi_period_unique").on(table.kpiId, table.periodStart, table.periodEnd), index("measurement_cycle_idx").on(table.cycleId), index("measurement_org_idx").on(table.organizationId)]);

export const strategicInitiatives = pgTable("strategic_initiative", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }), objectiveId: uuid("objective_id").notNull().references(() => strategicObjectives.id, { onDelete: "restrict" }),
  kpiId: uuid("kpi_id").references(() => strategicKpis.id, { onDelete: "restrict" }), title: varchar("title", { length: 200 }).notNull(), description: text("description").default("").notNull(), expectedResult: text("expected_result").default("").notNull(),
  ownerName: varchar("owner_name", { length: 160 }), sponsorName: varchar("sponsor_name", { length: 160 }), startDate: date("start_date"), dueDate: date("due_date"), priority: varchar("priority", { length: 20 }).default("medium").notNull(), status: varchar("status", { length: 24 }).default("draft").notNull(), progress: integer("progress").default(0).notNull(), plannedCost: varchar("planned_cost", { length: 60 }), actualCost: varchar("actual_cost", { length: 60 }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), approvedBy: text("approved_by").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("initiative_cycle_idx").on(table.cycleId), index("initiative_objective_idx").on(table.objectiveId)]);

export const routineTemplates = pgTable("routine_template", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }), cycleId: uuid("cycle_id").references(() => strategicCycles.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 200 }).notNull(), description: text("description").default("").notNull(), frequency: varchar("frequency", { length: 24 }).notNull(), responsibleUserId: text("responsible_user_id").references(() => users.id, { onDelete: "restrict" }), responsibleName: varchar("responsible_name", { length: 160 }), startDate: date("start_date").notNull(), weekday: integer("weekday"), monthday: integer("monthday"), customIntervalDays: integer("custom_interval_days"), timeOfDay: varchar("time_of_day", { length: 5 }), evidenceRequired: boolean("evidence_required").default(false).notNull(), active: boolean("active").default(true).notNull(), createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("routine_template_org_idx").on(table.organizationId)]);

export const routineExecutions = pgTable("routine_execution", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }), templateId: uuid("template_id").notNull().references(() => routineTemplates.id, { onDelete: "restrict" }), assignedUserId: text("assigned_user_id").references(() => users.id, { onDelete: "restrict" }), dueDate: date("due_date").notNull(), status: varchar("status", { length: 20 }).default("pending").notNull(), evidence: text("evidence").default("").notNull(), observation: text("observation").default("").notNull(), impediment: text("impediment").default("").notNull(), completedBy: text("completed_by").references(() => users.id, { onDelete: "restrict" }), completedAt: timestamp("completed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("routine_execution_template_due_unique").on(table.templateId, table.dueDate), index("routine_execution_assignee_idx").on(table.assignedUserId)]);

export const organizationPeople = pgTable("organization_person", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }), name: varchar("name", { length: 160 }).notNull(), email: varchar("email", { length: 255 }), employeeCode: varchar("employee_code", { length: 60 }), userId: text("user_id").references(() => users.id, { onDelete: "restrict" }), active: boolean("active").default(true).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("organization_person_org_idx").on(table.organizationId)]);

export const organizationPositions = pgTable("organization_position", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }), parentPositionId: uuid("parent_position_id"), title: varchar("title", { length: 160 }).notNull(), purpose: text("purpose").default("").notNull(), responsibilities: text("responsibilities").default("").notNull(), authority: text("authority").default("").notNull(), deliverables: text("deliverables").default("").notNull(), expectedHolders: integer("expected_holders").default(1).notNull(), sortOrder: integer("sort_order").default(0).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("organization_position_org_idx").on(table.organizationId)]);

export const positionAssignments = pgTable("position_assignment", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }), positionId: uuid("position_id").notNull().references(() => organizationPositions.id, { onDelete: "restrict" }), personId: uuid("person_id").notNull().references(() => organizationPeople.id, { onDelete: "restrict" }), assignmentType: varchar("assignment_type", { length: 20 }).default("holder").notNull(), startsAt: date("starts_at").notNull(), endsAt: date("ends_at"), notes: text("notes").default("").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("position_assignment_position_idx").on(table.positionId), index("position_assignment_person_idx").on(table.personId)]);

export const aiAssistanceRuns = pgTable("ai_assistance_run", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  requestedBy: text("requested_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  mode: varchar("mode", { length: 40 }).notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 40 }).notNull(),
  contextHash: varchar("context_hash", { length: 64 }).notNull(),
  contextSummary: jsonb("context_summary").default({}).notNull(),
  responseMetadata: jsonb("response_metadata").default({}).notNull(),
  status: varchar("status", { length: 24 }).default("pending").notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [index("ai_run_org_cycle_idx").on(table.organizationId, table.cycleId), index("ai_run_requester_idx").on(table.requestedBy)]);

export const aiSuggestions = pgTable("ai_suggestion", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull().references(() => aiAssistanceRuns.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  category: varchar("category", { length: 40 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  recommendation: text("recommendation").notNull(),
  rationale: text("rationale").notNull(),
  payload: jsonb("payload").default({}).notNull(),
  status: varchar("status", { length: 24 }).default("pending").notNull(),
  decidedBy: text("decided_by").references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("ai_suggestion_run_idx").on(table.runId), index("ai_suggestion_org_cycle_idx").on(table.organizationId, table.cycleId)]);

export const aiSuggestionApplications = pgTable("ai_suggestion_application", {
  id: uuid("id").defaultRandom().primaryKey(),
  suggestionId: uuid("suggestion_id").notNull().references(() => aiSuggestions.id, { onDelete: "restrict" }).unique(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  cycleId: uuid("cycle_id").notNull().references(() => strategicCycles.id, { onDelete: "restrict" }),
  applicationKind: varchar("application_kind", { length: 24 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  sourceRevision: integer("source_revision").notNull(),
  openedRevision: boolean("opened_revision").default(false).notNull(),
  appliedBy: text("applied_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  applicationSnapshot: jsonb("application_snapshot").default({}).notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("ai_application_org_cycle_idx").on(table.organizationId, table.cycleId), index("ai_application_entity_idx").on(table.entityType, table.entityId)]);

export const auditLogs = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  memberships: many(memberships),
}));
export const sessionRelations = relations(sessions, ({ one }) => ({ user: one(users, { fields: [sessions.userId], references: [users.id] }) }));
export const accountRelations = relations(accounts, ({ one }) => ({ user: one(users, { fields: [accounts.userId], references: [users.id] }) }));
export const organizationRelations = relations(organizations, ({ many }) => ({ companies: many(companies), memberships: many(memberships), cycles: many(strategicCycles) }));
export const companyRelations = relations(companies, ({ one, many }) => ({ organization: one(organizations, { fields: [companies.organizationId], references: [organizations.id] }), units: many(businessUnits) }));
export const membershipRelations = relations(memberships, ({ one }) => ({ user: one(users, { fields: [memberships.userId], references: [users.id] }), organization: one(organizations, { fields: [memberships.organizationId], references: [organizations.id] }) }));
export const cycleRelations = relations(strategicCycles, ({ one }) => ({ organization: one(organizations, { fields: [strategicCycles.organizationId], references: [organizations.id] }), company: one(companies, { fields: [strategicCycles.companyId], references: [companies.id] }) }));
