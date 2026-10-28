import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  actionItems,
  auditLogs,
  businessFacts,
  businessPortraits,
  companies,
  diagnosisSignals,
  planVersions,
  planningSections,
  questionnaireResponses,
  strategicCycles,
  strategicInitiatives,
  strategicKpis,
  strategicObjectives,
} from "@/db/schema";
import { analysisResult, type AnalysisCode, maturityResult } from "./catalogs";
import { BUSINESS_FACT_CATALOG, DIAGNOSIS_SIGNAL_CATALOG, KPI_TEMPLATES, OBJECTIVE_TEMPLATES } from "./inventory-catalog.generated";
import { requireActiveMembership, requireFormalApproval, requirePlanningWrite, requireTechnicalReview } from "./authorization";

const EDITABLE_STATES = ["draft", "under_revision"];

async function editableCycle(organizationId: string, cycleId: string) {
  const [cycle] = await db.select().from(strategicCycles).where(and(
    eq(strategicCycles.id, cycleId),
    eq(strategicCycles.organizationId, organizationId),
  )).limit(1);
  if (!cycle) throw new Error("Ciclo não pertence à organização informada.");
  if (!EDITABLE_STATES.includes(cycle.workflowStatus)) throw new Error("Esta versão está bloqueada para edição.");
  return cycle;
}

export async function createCycle(input: {
  userId: string;
  organizationId: string;
  companyId: string;
  name: string;
  startYear: number;
  endYear: number;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [company] = await db.select({ id: companies.id }).from(companies).where(and(
    eq(companies.id, input.companyId),
    eq(companies.organizationId, input.organizationId),
  )).limit(1);
  if (!company) throw new Error("Empresa não pertence à organização informada.");
  if (!input.name.trim() || input.endYear < input.startYear) throw new Error("Dados do ciclo inválidos.");

  return db.transaction(async (tx) => {
    const [cycle] = await tx.insert(strategicCycles).values({
      organizationId: input.organizationId,
      companyId: input.companyId,
      name: input.name.trim(),
      startYear: input.startYear,
      endYear: input.endYear,
      createdBy: input.userId,
    }).returning();
    await tx.insert(businessPortraits).values({
      organizationId: input.organizationId,
      cycleId: cycle.id,
      updatedBy: input.userId,
    });
    await tx.insert(auditLogs).values({
      actorUserId: input.userId,
      organizationId: input.organizationId,
      action: "cycle.created",
      entityType: "strategic_cycle",
      entityId: cycle.id,
    });
    return cycle;
  });
}

export async function saveBusinessPortrait(input: {
  userId: string;
  organizationId: string;
  cycleId: string;
  businessDescription: string;
  primaryCustomer: string;
  valueProposition: string;
  mainChallenge: string;
  expectedRevision?: number;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const cycle = await editableCycle(input.organizationId, input.cycleId);
  const expectedRevision = input.expectedRevision ?? cycle.revision;

  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: expectedRevision + 1, updatedAt: new Date() }).where(and(
      eq(strategicCycles.id, input.cycleId),
      eq(strategicCycles.organizationId, input.organizationId),
      eq(strategicCycles.revision, expectedRevision),
    )).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [portrait] = await tx.update(businessPortraits).set({
      businessDescription: input.businessDescription.trim(),
      primaryCustomer: input.primaryCustomer.trim(),
      valueProposition: input.valueProposition.trim(),
      mainChallenge: input.mainChallenge.trim(),
      updatedBy: input.userId,
      updatedAt: new Date(),
    }).where(and(
      eq(businessPortraits.cycleId, input.cycleId),
      eq(businessPortraits.organizationId, input.organizationId),
    )).returning();
    if (!portrait) throw new Error("Retrato do negócio não encontrado.");
    await tx.insert(auditLogs).values({
      actorUserId: input.userId,
      organizationId: input.organizationId,
      action: "business_portrait.updated",
      entityType: "business_portrait",
      entityId: portrait.id,
    });
    return portrait;
  });
}

export async function savePlanningSection(input: {
  userId: string;
  organizationId: string;
  cycleId: string;
  expectedRevision: number;
  phase: "direction" | "swot";
  data: Record<string, string>;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  const required = input.phase === "direction"
    ? ["mission", "vision", "values", "north"]
    : ["strengths", "weaknesses", "opportunities", "threats"];
  const completed = required.every((key) => input.data[key]?.trim());
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(
      eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision),
    )).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [section] = await tx.insert(planningSections).values({
      organizationId: input.organizationId, cycleId: input.cycleId, phase: input.phase, data: input.data, completed, updatedBy: input.userId,
    }).onConflictDoUpdate({
      target: [planningSections.cycleId, planningSections.phase],
      set: { data: input.data, completed, updatedBy: input.userId, updatedAt: new Date() },
    }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: `planning.${input.phase}.saved`, entityType: "strategic_cycle", entityId: input.cycleId });
    return section;
  });
}

export async function saveQuestionnaire(input: {
  userId: string;
  organizationId: string;
  cycleId: string;
  expectedRevision: number;
  questionnaireCode: "maturity" | AnalysisCode;
  answers: Record<string, number | null>;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  const result = input.questionnaireCode === "maturity"
    ? maturityResult(input.answers)
    : analysisResult(input.questionnaireCode, input.answers);
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(
      eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision),
    )).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [response] = await tx.insert(questionnaireResponses).values({
      organizationId: input.organizationId, cycleId: input.cycleId, questionnaireCode: input.questionnaireCode,
      answers: input.answers, result, completed: result.complete, updatedBy: input.userId,
    }).onConflictDoUpdate({
      target: [questionnaireResponses.cycleId, questionnaireResponses.questionnaireCode],
      set: { answers: input.answers, result, completed: result.complete, updatedBy: input.userId, updatedAt: new Date() },
    }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "questionnaire.saved", entityType: "questionnaire_response", entityId: response.id, metadata: { code: input.questionnaireCode } });
    return response;
  });
}

export async function saveBusinessFacts(input: {
  userId: string; organizationId: string; cycleId: string; expectedRevision: number;
  facts: Record<string, { value: string; unavailable: boolean; confidence: "exact" | "estimated" | "unavailable"; sourceNote?: string; referenceDate?: string }>;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  const normalized: Array<{
    definition: (typeof BUSINESS_FACT_CATALOG)[number];
    value: string | number | boolean | null;
    unavailable: boolean;
    confidence: "exact" | "estimated" | "unavailable";
    sourceNote?: string;
    referenceDate?: string;
  }> = [];
  for (const definition of BUSINESS_FACT_CATALOG) {
    const draft = input.facts[definition.code];
    if (!draft || (!draft.unavailable && draft.value.trim() === "")) continue;
    if ((draft.sourceNote ?? "").length > 120) throw new Error("A origem do fato deve ter no máximo 120 caracteres.");
    if (draft.unavailable || draft.confidence === "unavailable") {
      normalized.push({ definition, value: null, unavailable: true, confidence: "unavailable", sourceNote: draft.sourceNote, referenceDate: draft.referenceDate });
      continue;
    }
    let value: string | number | boolean = draft.value.trim();
    if (["currency", "percentage", "number", "days", "hours"].includes(definition.valueType)) {
      const numeric = Number(value.replace(",", "."));
      if (!Number.isFinite(numeric)) throw new Error(`Valor inválido para ${definition.label}.`);
      if (!definition.allowNegative && numeric < 0) throw new Error(`${definition.label} não aceita valor negativo.`);
      if (definition.valueType === "percentage" && (numeric > 100 || numeric < (definition.allowNegative ? -100 : 0))) throw new Error(`Percentual inválido para ${definition.label}.`);
      value = numeric;
    } else if (definition.valueType === "boolean") {
      if (!['true','false'].includes(value)) throw new Error(`Responda sim ou não em ${definition.label}.`);
      value = value === "true";
    } else if (value.length > 120) throw new Error(`${definition.label} aceita no máximo 120 caracteres.`);
    normalized.push({ definition, value, unavailable: false, confidence: draft.confidence, sourceNote: draft.sourceNote, referenceDate: draft.referenceDate });
  }
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    for (const fact of normalized) await tx.insert(businessFacts).values({ organizationId: input.organizationId, cycleId: input.cycleId, code: fact.definition.code, value: fact.value, unavailable: fact.unavailable, confidence: fact.confidence, sourceNote: fact.sourceNote || null, referenceDate: fact.referenceDate || null, updatedBy: input.userId }).onConflictDoUpdate({ target: [businessFacts.cycleId, businessFacts.code], set: { value: fact.value, unavailable: fact.unavailable, confidence: fact.confidence, sourceNote: fact.sourceNote || null, referenceDate: fact.referenceDate || null, updatedBy: input.userId, updatedAt: new Date() } });
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "business_facts.saved", entityType: "strategic_cycle", entityId: input.cycleId, metadata: { count: normalized.length } });
    return normalized.length;
  });
}

export async function saveDiagnosisSignals(input: { userId: string; organizationId: string; cycleId: string; expectedRevision: number; signals: Record<string, { selected: boolean; intensity: "low" | "medium" | "high"; justification?: string }> }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    for (const definition of DIAGNOSIS_SIGNAL_CATALOG) {
      const signal = input.signals[definition.code] ?? { selected: false, intensity: "medium" as const };
      await tx.insert(diagnosisSignals).values({ organizationId: input.organizationId, cycleId: input.cycleId, code: definition.code, dimension: definition.dimension, quadrant: definition.quadrant, selected: signal.selected, intensity: signal.intensity, justification: signal.justification?.trim(), updatedBy: input.userId }).onConflictDoUpdate({ target: [diagnosisSignals.cycleId, diagnosisSignals.code], set: { selected: signal.selected, intensity: signal.intensity, justification: signal.justification?.trim(), updatedBy: input.userId, updatedAt: new Date() } });
    }
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "diagnosis_signals.saved", entityType: "strategic_cycle", entityId: input.cycleId });
  });
}

export async function applyObjectiveTemplate(input: { userId: string; organizationId: string; cycleId: string; expectedRevision: number; objectiveCode: string }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  const template = OBJECTIVE_TEMPLATES.find((item) => item.code === input.objectiveCode);
  if (!template) throw new Error("Objetivo-modelo desconhecido.");
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de aplicar.");
    let [objective] = await tx.insert(strategicObjectives).values({ organizationId: input.organizationId, cycleId: input.cycleId, templateCode: template.code, title: template.title, description: template.description, perspective: template.dimension, createdBy: input.userId }).onConflictDoNothing().returning();
    if (!objective) [objective] = await tx.select().from(strategicObjectives).where(and(eq(strategicObjectives.cycleId, input.cycleId), eq(strategicObjectives.templateCode, template.code))).limit(1);
    for (const kpi of KPI_TEMPLATES.filter((item) => item.objectiveCode === template.code)) await tx.insert(strategicKpis).values({ organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: objective.id, templateCode: kpi.code, name: kpi.name, definition: kpi.description, unit: kpi.unit, source: kpi.sourceHint, periodicity: kpi.frequency, direction: kpi.direction, formula: kpi.formula, baseline: null, target: null, ownerName: null, createdBy: input.userId }).onConflictDoNothing();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "catalog.objective_applied", entityType: "strategic_objective", entityId: objective.id, metadata: { objectiveCode: template.code } });
    return objective;
  });
}

export async function addObjective(input: {
  userId: string; organizationId: string; cycleId: string; expectedRevision: number;
  title: string; description?: string; perspective?: string; ownerName?: string; priority?: string; dueDate?: string;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  if (!input.title.trim()) throw new Error("Informe o objetivo.");
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.revision, input.expectedRevision), eq(strategicCycles.organizationId, input.organizationId))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [objective] = await tx.insert(strategicObjectives).values({ organizationId: input.organizationId, cycleId: input.cycleId, title: input.title.trim(), description: input.description?.trim(), perspective: input.perspective || null, ownerName: input.ownerName || null, priority: input.priority || "medium", dueDate: input.dueDate || null, createdBy: input.userId }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "objective.created", entityType: "strategic_objective", entityId: objective.id });
    return objective;
  });
}

async function objectiveInCycle(organizationId: string, cycleId: string, objectiveId: string) {
  const [objective] = await db.select().from(strategicObjectives).where(and(eq(strategicObjectives.id, objectiveId), eq(strategicObjectives.cycleId, cycleId), eq(strategicObjectives.organizationId, organizationId))).limit(1);
  if (!objective) throw new Error("Objetivo não pertence ao ciclo informado.");
  return objective;
}

export async function addKpi(input: {
  userId: string; organizationId: string; cycleId: string; expectedRevision: number; objectiveId: string;
  name: string; definition?: string; unit: string; source: string; periodicity: string; direction: string; formula: string; baseline?: string; target?: string; ownerName?: string;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  await objectiveInCycle(input.organizationId, input.cycleId, input.objectiveId);
  if (![input.name, input.unit, input.source, input.periodicity, input.direction, input.formula].every((item) => item.trim())) throw new Error("Complete a definição do indicador.");
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.revision, input.expectedRevision), eq(strategicCycles.organizationId, input.organizationId))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [kpi] = await tx.insert(strategicKpis).values({
      organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: input.objectiveId,
      name: input.name.trim(), definition: input.definition?.trim(), unit: input.unit.trim(), source: input.source.trim(),
      periodicity: input.periodicity.trim(), direction: input.direction.trim(), formula: input.formula.trim(),
      baseline: input.baseline || null, target: input.target || null, ownerName: input.ownerName || null, createdBy: input.userId,
    }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "kpi.created", entityType: "strategic_kpi", entityId: kpi.id });
    return kpi;
  });
}

export async function addActionItem(input: {
  userId: string; organizationId: string; cycleId: string; expectedRevision: number; objectiveId: string;
  kpiId?: string; title: string; description?: string; why?: string; how?: string; location?: string;
  ownerName?: string; startDate?: string; dueDate?: string; priority?: string; plannedCost?: string;
  origin?: string; originJustification?: string; dependencies?: string; risks?: string;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await editableCycle(input.organizationId, input.cycleId);
  await objectiveInCycle(input.organizationId, input.cycleId, input.objectiveId);
  if (!input.title.trim()) throw new Error("Informe a ação.");
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(strategicCycles).set({ revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.revision, input.expectedRevision), eq(strategicCycles.organizationId, input.organizationId))).returning({ id: strategicCycles.id });
    if (!locked) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de salvar.");
    const [action] = await tx.insert(actionItems).values({ organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: input.objectiveId, kpiId: input.kpiId || null, title: input.title.trim(), description: input.description?.trim(), why: input.why?.trim(), how: input.how?.trim(), location: input.location || null, ownerName: input.ownerName || null, startDate: input.startDate || null, dueDate: input.dueDate || null, priority: input.priority || "medium", plannedCost: input.plannedCost || null, origin: input.origin || "objective", originJustification: input.originJustification?.trim(), dependencies: input.dependencies?.trim(), risks: input.risks?.trim(), createdBy: input.userId }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "action.created", entityType: "action_item", entityId: action.id });
    return action;
  });
}

export async function getPlanData(userId: string, organizationId: string, cycleId: string) {
  await requireActiveMembership(userId, organizationId);
  const [cycle] = await db.select().from(strategicCycles).where(and(eq(strategicCycles.id, cycleId), eq(strategicCycles.organizationId, organizationId))).limit(1);
  if (!cycle) throw new Error("Ciclo não pertence à organização informada.");
  const [portrait, facts, signals, sections, questionnaires, objectives, kpis, initiatives, actions, versions] = await Promise.all([
    db.select().from(businessPortraits).where(and(eq(businessPortraits.cycleId, cycleId), eq(businessPortraits.organizationId, organizationId))),
    db.select().from(businessFacts).where(and(eq(businessFacts.cycleId, cycleId), eq(businessFacts.organizationId, organizationId))),
    db.select().from(diagnosisSignals).where(and(eq(diagnosisSignals.cycleId, cycleId), eq(diagnosisSignals.organizationId, organizationId))),
    db.select().from(planningSections).where(and(eq(planningSections.cycleId, cycleId), eq(planningSections.organizationId, organizationId))),
    db.select().from(questionnaireResponses).where(and(eq(questionnaireResponses.cycleId, cycleId), eq(questionnaireResponses.organizationId, organizationId))),
    db.select().from(strategicObjectives).where(and(eq(strategicObjectives.cycleId, cycleId), eq(strategicObjectives.organizationId, organizationId))),
    db.select().from(strategicKpis).where(and(eq(strategicKpis.cycleId, cycleId), eq(strategicKpis.organizationId, organizationId))),
    db.select().from(strategicInitiatives).where(and(eq(strategicInitiatives.cycleId, cycleId), eq(strategicInitiatives.organizationId, organizationId))),
    db.select().from(actionItems).where(and(eq(actionItems.cycleId, cycleId), eq(actionItems.organizationId, organizationId))),
    db.select().from(planVersions).where(and(eq(planVersions.cycleId, cycleId), eq(planVersions.organizationId, organizationId))).orderBy(desc(planVersions.versionNumber)),
  ]);
  return { cycle, portrait: portrait[0] ?? null, facts, signals, sections, questionnaires, objectives, kpis, initiatives, actions, versions };
}

export function calculatePlanCompletion(plan: Awaited<ReturnType<typeof getPlanData>>) {
  const portrait = plan.portrait;
  const phase1 = !!portrait && [portrait.businessDescription, portrait.primaryCustomer, portrait.valueProposition, portrait.mainChallenge].every((value) => value.trim());
  const maturity = plan.questionnaires.find((item) => item.questionnaireCode === "maturity");
  const analyses = plan.questionnaires.filter((item) => item.questionnaireCode !== "maturity");
  const phase2 = !!maturity?.completed && analyses.some((item) => Object.keys(item.answers as object).length > 0);
  const phase3 = !!plan.sections.find((item) => item.phase === "direction" && item.completed);
  const phase4 = !!plan.sections.find((item) => item.phase === "swot" && item.completed);
  const phase5 = plan.objectives.length >= 3 && plan.objectives.length <= 7 && plan.objectives.every((objective) => plan.kpis.some((kpi) => kpi.objectiveId === objective.id));
  const phase6 = plan.objectives.length > 0 && plan.objectives.every((objective) => plan.actions.some((action) => action.objectiveId === objective.id));
  const phases = [phase1, phase2, phase3, phase4, phase5, phase6];
  return { phases, completed: phases.filter(Boolean).length, percent: Math.round(phases.filter(Boolean).length / 6 * 100), ready: phases.every(Boolean) };
}

export async function submitPlanForReview(input: { userId: string; organizationId: string; cycleId: string; expectedRevision: number }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const plan = await getPlanData(input.userId, input.organizationId, input.cycleId);
  if (!calculatePlanCompletion(plan).ready) throw new Error("Complete as seis fases antes de enviar para revisão.");
  const [cycle] = await db.update(strategicCycles).set({ workflowStatus: "in_review", submittedAt: new Date(), revision: input.expectedRevision + 1, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.revision, input.expectedRevision), eq(strategicCycles.workflowStatus, plan.cycle.workflowStatus))).returning();
  if (!cycle) throw new Error("O ciclo foi alterado em outra sessão. Recarregue antes de enviar.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "plan.submitted", entityType: "strategic_cycle", entityId: input.cycleId });
  return cycle;
}

export async function technicalReviewPlan(input: { userId: string; organizationId: string; cycleId: string }) {
  await requireTechnicalReview(input.userId, input.organizationId);
  const [cycle] = await db.update(strategicCycles).set({ workflowStatus: "awaiting_approval", technicalReviewedAt: new Date(), technicalReviewedBy: input.userId, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.workflowStatus, "in_review"))).returning();
  if (!cycle) throw new Error("O plano não está aguardando revisão técnica.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "plan.technical_reviewed", entityType: "strategic_cycle", entityId: input.cycleId });
  return cycle;
}

export async function formallyApprovePlan(input: { userId: string; organizationId: string; cycleId: string }) {
  await requireFormalApproval(input.userId, input.organizationId);
  const plan = await getPlanData(input.userId, input.organizationId, input.cycleId);
  if (plan.cycle.workflowStatus !== "awaiting_approval" || !plan.cycle.technicalReviewedAt) throw new Error("O plano precisa da revisão técnica antes da aprovação formal.");
  if (!calculatePlanCompletion(plan).ready) throw new Error("O plano deixou de atender aos critérios de completude.");
  const versionNumber = (plan.versions[0]?.versionNumber ?? 0) + 1;
  const snapshot = { portrait: plan.portrait, facts: plan.facts, signals: plan.signals, sections: plan.sections, questionnaires: plan.questionnaires, objectives: plan.objectives, kpis: plan.kpis, initiatives: plan.initiatives, actions: plan.actions };
  return db.transaction(async (tx) => {
    const [version] = await tx.insert(planVersions).values({ organizationId: input.organizationId, cycleId: input.cycleId, versionNumber, sourceRevision: plan.cycle.revision, snapshot, approvedBy: input.userId }).returning();
    const [cycle] = await tx.update(strategicCycles).set({ workflowStatus: "approved", status: "active", approvedAt: new Date(), approvedBy: input.userId, officialVersionId: version.id, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.workflowStatus, "awaiting_approval"), eq(strategicCycles.revision, plan.cycle.revision))).returning();
    if (!cycle) throw new Error("O ciclo foi alterado durante a aprovação.");
    await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "plan.approved", entityType: "plan_version", entityId: version.id, metadata: { versionNumber } });
    return { cycle, version };
  });
}

export async function startPlanRevision(input: { userId: string; organizationId: string; cycleId: string; expectedRevision: number }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [cycle] = await db.update(strategicCycles).set({ workflowStatus: "under_revision", revision: input.expectedRevision + 1, technicalReviewedAt: null, technicalReviewedBy: null, submittedAt: null, updatedAt: new Date() }).where(and(eq(strategicCycles.id, input.cycleId), eq(strategicCycles.organizationId, input.organizationId), eq(strategicCycles.workflowStatus, "approved"), eq(strategicCycles.revision, input.expectedRevision))).returning();
  if (!cycle) throw new Error("Somente um plano aprovado pode iniciar nova revisão.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "plan.revision_started", entityType: "strategic_cycle", entityId: input.cycleId, metadata: { officialVersionId: cycle.officialVersionId } });
  return cycle;
}

export async function getWorkspace(userId: string, organizationId: string) {
  await requireActiveMembership(userId, organizationId);
  return db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.id, organizationId),
    with: { companies: true, cycles: true },
  });
}
