import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  actionItems,
  auditLogs,
  kpiMeasurements,
  organizationPeople,
  organizationPositions,
  planVersions,
  positionAssignments,
  routineExecutions,
  routineTemplates,
  strategicCycles,
  strategicInitiatives,
  strategicKpis,
  strategicObjectives,
} from "@/db/schema";
import { requireActiveMembership, requireCapability, requirePlanningWrite } from "./authorization";

async function cycleInScope(organizationId: string, cycleId: string) {
  const [cycle] = await db.select().from(strategicCycles).where(and(eq(strategicCycles.id, cycleId), eq(strategicCycles.organizationId, organizationId))).limit(1);
  if (!cycle) throw new Error("Ciclo não pertence à organização informada.");
  return cycle;
}

async function kpiInScope(organizationId: string, cycleId: string, kpiId: string) {
  const [kpi] = await db.select().from(strategicKpis).where(and(eq(strategicKpis.id, kpiId), eq(strategicKpis.cycleId, cycleId), eq(strategicKpis.organizationId, organizationId))).limit(1);
  if (!kpi) throw new Error("Indicador não pertence ao ciclo informado.");
  return kpi;
}

export async function recordKpiMeasurement(input: {
  userId: string; organizationId: string; cycleId: string; kpiId: string;
  periodStart: string; periodEnd: string; actualValue: string; evidence?: string; observation?: string;
}) {
  await requireCapability(input.userId, input.organizationId, "kpi.measure", "Sem permissão para registrar medições.");
  const cycle = await cycleInScope(input.organizationId, input.cycleId);
  const kpi = await kpiInScope(input.organizationId, input.cycleId, input.kpiId);
  if (!input.periodStart || !input.periodEnd || input.periodEnd < input.periodStart) throw new Error("Período da medição inválido.");
  if (input.actualValue.trim() === "") throw new Error("Informe o realizado; zero é aceito como valor explícito.");
  const [officialVersion] = cycle.officialVersionId
    ? await db.select().from(planVersions).where(and(eq(planVersions.id, cycle.officialVersionId), eq(planVersions.organizationId, input.organizationId))).limit(1)
    : [];
  const [measurement] = await db.insert(kpiMeasurements).values({
    organizationId: input.organizationId, cycleId: input.cycleId, kpiId: input.kpiId,
    planVersionId: officialVersion?.id ?? null, periodStart: input.periodStart, periodEnd: input.periodEnd,
    actualValue: input.actualValue.trim(), targetSnapshot: kpi.target,
    definitionSnapshot: { name: kpi.name, definition: kpi.definition, unit: kpi.unit, formula: kpi.formula, source: kpi.source, periodicity: kpi.periodicity, direction: kpi.direction, ownerName: kpi.ownerName },
    evidence: input.evidence?.trim(), observation: input.observation?.trim(), createdBy: input.userId,
  }).returning();
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "kpi.measurement_recorded", entityType: "kpi_measurement", entityId: measurement.id, metadata: { kpiId: input.kpiId, periodEnd: input.periodEnd } });
  return measurement;
}

export async function validateKpiMeasurement(input: { userId: string; organizationId: string; measurementId: string; decision: "validated" | "rejected" }) {
  await requireCapability(input.userId, input.organizationId, "kpi.validate", "Sem permissão para validar medições.");
  const [measurement] = await db.update(kpiMeasurements).set({ validationStatus: input.decision, validatedBy: input.userId, validatedAt: new Date() }).where(and(eq(kpiMeasurements.id, input.measurementId), eq(kpiMeasurements.organizationId, input.organizationId), eq(kpiMeasurements.validationStatus, "pending"))).returning();
  if (!measurement) throw new Error("Medição pendente não encontrada neste escopo.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: `kpi.measurement_${input.decision}`, entityType: "kpi_measurement", entityId: measurement.id });
  return measurement;
}

export async function createInitiative(input: {
  userId: string; organizationId: string; cycleId: string; objectiveId: string; kpiId?: string;
  title: string; description?: string; expectedResult?: string; ownerName?: string; sponsorName?: string;
  startDate?: string; dueDate?: string; priority?: string; plannedCost?: string;
}) {
  await requirePlanningWrite(input.userId, input.organizationId);
  await cycleInScope(input.organizationId, input.cycleId);
  const [objective] = await db.select().from(strategicObjectives).where(and(eq(strategicObjectives.id, input.objectiveId), eq(strategicObjectives.cycleId, input.cycleId), eq(strategicObjectives.organizationId, input.organizationId))).limit(1);
  if (!objective) throw new Error("Objetivo não pertence ao ciclo informado.");
  if (input.kpiId) await kpiInScope(input.organizationId, input.cycleId, input.kpiId);
  if (!input.title.trim()) throw new Error("Informe o título da iniciativa.");
  const [initiative] = await db.insert(strategicInitiatives).values({ organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: input.objectiveId, kpiId: input.kpiId || null, title: input.title.trim(), description: input.description?.trim(), expectedResult: input.expectedResult?.trim(), ownerName: input.ownerName || null, sponsorName: input.sponsorName || null, startDate: input.startDate || null, dueDate: input.dueDate || null, priority: input.priority || "medium", plannedCost: input.plannedCost || null, createdBy: input.userId }).returning();
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "initiative.created", entityType: "strategic_initiative", entityId: initiative.id });
  return initiative;
}

export async function transitionInitiative(input: { userId: string; organizationId: string; initiativeId: string; nextStatus: "in_review" | "approved" | "active" | "on_hold" | "completed" | "cancelled" }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [current] = await db.select().from(strategicInitiatives).where(and(eq(strategicInitiatives.id, input.initiativeId), eq(strategicInitiatives.organizationId, input.organizationId))).limit(1);
  if (!current) throw new Error("Iniciativa não encontrada neste escopo.");
  const allowed: Record<string, string[]> = { draft: ["in_review", "cancelled"], in_review: ["approved", "cancelled"], approved: ["active", "cancelled"], active: ["on_hold", "completed", "cancelled"], on_hold: ["active", "cancelled"] };
  if (!allowed[current.status]?.includes(input.nextStatus)) throw new Error("Transição de iniciativa não permitida.");
  if (["in_review", "approved", "active"].includes(input.nextStatus) && (!current.expectedResult.trim() || !current.dueDate)) throw new Error("Resultado esperado e prazo são obrigatórios para submeter ou aprovar.");
  if (input.nextStatus === "active" && !current.ownerName) throw new Error("Responsável é obrigatório para ativar a iniciativa.");
  const [initiative] = await db.update(strategicInitiatives).set({ status: input.nextStatus, approvedBy: input.nextStatus === "approved" ? input.userId : current.approvedBy, approvedAt: input.nextStatus === "approved" ? new Date() : current.approvedAt }).where(and(eq(strategicInitiatives.id, input.initiativeId), eq(strategicInitiatives.organizationId, input.organizationId), eq(strategicInitiatives.status, current.status))).returning();
  if (!initiative) throw new Error("A iniciativa foi alterada em outra sessão.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: `initiative.${input.nextStatus}`, entityType: "strategic_initiative", entityId: initiative.id });
  return initiative;
}

export async function deriveActionFromInitiative(input: { userId: string; organizationId: string; initiativeId: string }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [initiative] = await db.select().from(strategicInitiatives).where(and(eq(strategicInitiatives.id, input.initiativeId), eq(strategicInitiatives.organizationId, input.organizationId))).limit(1);
  if (!initiative || !["approved", "active"].includes(initiative.status)) throw new Error("Somente iniciativa aprovada ou ativa pode gerar ação.");
  const [existing] = await db.select({ id: actionItems.id }).from(actionItems).where(and(eq(actionItems.initiativeId, initiative.id), eq(actionItems.organizationId, input.organizationId), ne(actionItems.status, "cancelled"))).limit(1);
  if (existing) throw new Error("Já existe ação viva derivada desta iniciativa.");
  const [action] = await db.insert(actionItems).values({ organizationId: input.organizationId, cycleId: initiative.cycleId, objectiveId: initiative.objectiveId, kpiId: initiative.kpiId, initiativeId: initiative.id, title: initiative.title, description: initiative.description, why: initiative.expectedResult, ownerName: initiative.ownerName, startDate: initiative.startDate, dueDate: initiative.dueDate, priority: initiative.priority, plannedCost: initiative.plannedCost, origin: "initiative", createdBy: input.userId }).returning();
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "initiative.action_derived", entityType: "action_item", entityId: action.id, metadata: { initiativeId: initiative.id } });
  return action;
}

export async function createRoutineTemplate(input: { userId: string; organizationId: string; cycleId?: string; name: string; description?: string; frequency: string; responsibleUserId?: string; responsibleName?: string; startDate: string; weekday?: number; monthday?: number; customIntervalDays?: number; timeOfDay?: string; evidenceRequired?: boolean }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  if (input.cycleId) await cycleInScope(input.organizationId, input.cycleId);
  if (!input.name.trim() || !input.startDate) throw new Error("Nome e início são obrigatórios.");
  if (input.frequency === "weekly" && (input.weekday === undefined || input.weekday < 0 || input.weekday > 6)) throw new Error("Informe o dia da semana.");
  if (input.frequency === "monthly" && (!input.monthday || input.monthday < 1 || input.monthday > 28)) throw new Error("Dia do mês deve estar entre 1 e 28.");
  const [template] = await db.insert(routineTemplates).values({ organizationId: input.organizationId, cycleId: input.cycleId || null, name: input.name.trim(), description: input.description?.trim(), frequency: input.frequency, responsibleUserId: input.responsibleUserId || null, responsibleName: input.responsibleName || null, startDate: input.startDate, weekday: input.weekday, monthday: input.monthday, customIntervalDays: input.customIntervalDays, timeOfDay: input.timeOfDay || null, evidenceRequired: input.evidenceRequired ?? false, createdBy: input.userId }).returning();
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "routine.template_created", entityType: "routine_template", entityId: template.id });
  return template;
}

export async function generateRoutineExecution(input: { userId: string; organizationId: string; templateId: string; dueDate: string }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [template] = await db.select().from(routineTemplates).where(and(eq(routineTemplates.id, input.templateId), eq(routineTemplates.organizationId, input.organizationId), eq(routineTemplates.active, true))).limit(1);
  if (!template) throw new Error("Modelo de rotina ativo não encontrado.");
  const [execution] = await db.insert(routineExecutions).values({ organizationId: input.organizationId, templateId: input.templateId, assignedUserId: template.responsibleUserId, dueDate: input.dueDate }).onConflictDoNothing().returning();
  if (!execution) throw new Error("Execução já gerada para esta data.");
  return execution;
}

export async function completeRoutineExecution(input: { userId: string; organizationId: string; executionId: string; evidence?: string; observation?: string; impediment?: string }) {
  const membership = await requireActiveMembership(input.userId, input.organizationId);
  const [execution] = await db.select().from(routineExecutions).where(and(eq(routineExecutions.id, input.executionId), eq(routineExecutions.organizationId, input.organizationId))).limit(1);
  if (!execution) throw new Error("Execução não encontrada.");
  const [template] = await db.select().from(routineTemplates).where(eq(routineTemplates.id, execution.templateId)).limit(1);
  const manages = ["group_admin", "organization_admin", "manager"].includes(membership.role);
  if (!manages && execution.assignedUserId !== input.userId) throw new Error("A rotina não está atribuída a este usuário.");
  if (template.evidenceRequired && !input.evidence?.trim() && !input.impediment?.trim()) throw new Error("Informe evidência ou impedimento.");
  const status = input.impediment?.trim() ? "blocked" : "completed";
  const [updated] = await db.update(routineExecutions).set({ status, evidence: input.evidence?.trim(), observation: input.observation?.trim(), impediment: input.impediment?.trim(), completedBy: input.userId, completedAt: new Date() }).where(and(eq(routineExecutions.id, input.executionId), eq(routineExecutions.status, "pending"))).returning();
  if (!updated) throw new Error("Execução já encerrada.");
  return updated;
}

export async function createOrganizationPerson(input: { userId: string; organizationId: string; name: string; email?: string; employeeCode?: string }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  if (!input.name.trim()) throw new Error("Informe o nome da pessoa.");
  const [person] = await db.insert(organizationPeople).values({ organizationId: input.organizationId, name: input.name.trim(), email: input.email || null, employeeCode: input.employeeCode || null }).returning();
  return person;
}

export async function createOrganizationPosition(input: { userId: string; organizationId: string; title: string; purpose?: string; responsibilities?: string; authority?: string; deliverables?: string; parentPositionId?: string; expectedHolders?: number }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  if (input.parentPositionId) {
    const [parent] = await db.select().from(organizationPositions).where(and(eq(organizationPositions.id, input.parentPositionId), eq(organizationPositions.organizationId, input.organizationId))).limit(1);
    if (!parent) throw new Error("Posição superior não pertence à organização.");
  }
  const [position] = await db.insert(organizationPositions).values({ organizationId: input.organizationId, title: input.title.trim(), purpose: input.purpose?.trim(), responsibilities: input.responsibilities?.trim(), authority: input.authority?.trim(), deliverables: input.deliverables?.trim(), parentPositionId: input.parentPositionId || null, expectedHolders: input.expectedHolders || 1 }).returning();
  return position;
}

export async function assignPersonToPosition(input: { userId: string; organizationId: string; positionId: string; personId: string; assignmentType?: string; startsAt: string; notes?: string }) {
  await requirePlanningWrite(input.userId, input.organizationId);
  const [[position], [person]] = await Promise.all([
    db.select().from(organizationPositions).where(and(eq(organizationPositions.id, input.positionId), eq(organizationPositions.organizationId, input.organizationId))).limit(1),
    db.select().from(organizationPeople).where(and(eq(organizationPeople.id, input.personId), eq(organizationPeople.organizationId, input.organizationId))).limit(1),
  ]);
  if (!position || !person) throw new Error("Pessoa e posição devem pertencer à mesma organização.");
  const [assignment] = await db.insert(positionAssignments).values({ organizationId: input.organizationId, positionId: input.positionId, personId: input.personId, assignmentType: input.assignmentType || "holder", startsAt: input.startsAt, notes: input.notes?.trim() }).returning();
  return assignment;
}

export async function getInventoryWorkspace(userId: string, organizationId: string, cycleId?: string) {
  await requireActiveMembership(userId, organizationId);
  const cycleFilter = cycleId ? and(eq(strategicCycles.id, cycleId), eq(strategicCycles.organizationId, organizationId)) : eq(strategicCycles.organizationId, organizationId);
  const [cycles, objectives, kpis, measurements, initiatives, actions, templates, executions, people, positions, assignments] = await Promise.all([
    db.select().from(strategicCycles).where(cycleFilter).orderBy(desc(strategicCycles.createdAt)),
    cycleId ? db.select().from(strategicObjectives).where(and(eq(strategicObjectives.cycleId, cycleId), eq(strategicObjectives.organizationId, organizationId))) : Promise.resolve([]),
    cycleId ? db.select().from(strategicKpis).where(and(eq(strategicKpis.cycleId, cycleId), eq(strategicKpis.organizationId, organizationId))) : Promise.resolve([]),
    cycleId ? db.select().from(kpiMeasurements).where(and(eq(kpiMeasurements.cycleId, cycleId), eq(kpiMeasurements.organizationId, organizationId))).orderBy(desc(kpiMeasurements.periodEnd)) : Promise.resolve([]),
    cycleId ? db.select().from(strategicInitiatives).where(and(eq(strategicInitiatives.cycleId, cycleId), eq(strategicInitiatives.organizationId, organizationId))) : Promise.resolve([]),
    cycleId ? db.select().from(actionItems).where(and(eq(actionItems.cycleId, cycleId), eq(actionItems.organizationId, organizationId))) : Promise.resolve([]),
    db.select().from(routineTemplates).where(eq(routineTemplates.organizationId, organizationId)),
    db.select().from(routineExecutions).where(eq(routineExecutions.organizationId, organizationId)).orderBy(desc(routineExecutions.dueDate)),
    db.select().from(organizationPeople).where(eq(organizationPeople.organizationId, organizationId)),
    db.select().from(organizationPositions).where(eq(organizationPositions.organizationId, organizationId)),
    db.select().from(positionAssignments).where(eq(positionAssignments.organizationId, organizationId)),
  ]);
  return { cycles, objectives, kpis, measurements, initiatives, actions, templates, executions, people, positions, assignments };
}

export type InventoryWorkspace = Awaited<ReturnType<typeof getInventoryWorkspace>>;
export type PerformanceStatus = "on_target" | "attention" | "off_target" | "no_measurement" | "not_comparable";

export function parseDashboardNumber(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const cleaned = value.trim().replace(/\s/g, "").replace(/R\$/gi, "").replace(/%/g, "").replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) normalized = comma > dot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  else if (comma >= 0) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if ((cleaned.match(/\./g) ?? []).length > 1) normalized = cleaned.replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLowerBetter(direction: string) {
  const normalized = direction.toLowerCase();
  return normalized.includes("lower") || normalized.includes("menor") || normalized.includes("reduz");
}

function performanceStatus(actual: number, target: number, direction: string): { status: PerformanceStatus; attainmentPercent: number } {
  const lowerBetter = isLowerBetter(direction);
  const onTarget = lowerBetter ? actual <= target : actual >= target;
  if (onTarget) return { status: "on_target", attainmentPercent: 100 };
  const denominator = Math.max(Math.abs(target), 1);
  const relativeGap = lowerBetter ? (actual - target) / denominator : (target - actual) / denominator;
  const attainmentPercent = Math.max(0, Math.min(100, Math.round((1 - relativeGap) * 100)));
  return { status: relativeGap <= 0.2 ? "attention" : "off_target", attainmentPercent };
}

function averageProgress(items: { progress: number; status: string }[]) {
  const live = items.filter((item) => item.status !== "cancelled");
  if (!live.length) return null;
  return Math.round(live.reduce((sum, item) => sum + Math.max(0, Math.min(100, item.progress)), 0) / live.length);
}

function costSummary(items: { plannedCost: string | null; actualCost: string | null; status: string }[]) {
  const live = items.filter((item) => item.status !== "cancelled");
  const plannedValues = live.map((item) => parseDashboardNumber(item.plannedCost)).filter((value): value is number => value !== null);
  const actualValues = live.map((item) => parseDashboardNumber(item.actualCost)).filter((value): value is number => value !== null);
  const planned = plannedValues.length ? plannedValues.reduce((sum, value) => sum + value, 0) : null;
  const actual = actualValues.length ? actualValues.reduce((sum, value) => sum + value, 0) : null;
  const variance = planned !== null && actual !== null ? actual - planned : null;
  return { planned, actual, variance, plannedCoverage: plannedValues.length, actualCoverage: actualValues.length, total: live.length };
}

export function buildDashboard(data: InventoryWorkspace, today = new Date()) {
  const todayKey = today.toISOString().slice(0, 10);
  const latestByKpi = new Map<string, typeof data.measurements[number]>();
  const latestValidatedByKpi = new Map<string, typeof data.measurements[number]>();
  for (const measurement of data.measurements) {
    const current = latestByKpi.get(measurement.kpiId);
    if (!current || measurement.periodEnd > current.periodEnd) latestByKpi.set(measurement.kpiId, measurement);
    if (measurement.validationStatus === "validated") {
      const validated = latestValidatedByKpi.get(measurement.kpiId);
      if (!validated || measurement.periodEnd > validated.periodEnd) latestValidatedByKpi.set(measurement.kpiId, measurement);
    }
  }

  const kpiPerformance = data.kpis.map((kpi) => {
    const latestMeasurement = latestByKpi.get(kpi.id) ?? null;
    const measurement = latestValidatedByKpi.get(kpi.id) ?? null;
    const actual = parseDashboardNumber(measurement?.actualValue);
    const targetLabel = measurement?.targetSnapshot || kpi.target;
    const target = parseDashboardNumber(targetLabel);
    const result = !measurement
      ? { status: "no_measurement" as const, attainmentPercent: null }
      : actual === null || target === null
        ? { status: "not_comparable" as const, attainmentPercent: null }
        : performanceStatus(actual, target, kpi.direction);
    return {
      kpiId: kpi.id,
      objectiveId: kpi.objectiveId,
      name: kpi.name,
      unit: kpi.unit,
      periodicity: kpi.periodicity,
      direction: kpi.direction,
      ownerName: kpi.ownerName,
      actualLabel: measurement?.actualValue ?? null,
      targetLabel: targetLabel ?? null,
      periodEnd: measurement?.periodEnd ?? null,
      latestValidationStatus: latestMeasurement?.validationStatus ?? null,
      ...result,
    };
  });

  const comparable = kpiPerformance.filter((item) => ["on_target", "attention", "off_target"].includes(item.status));
  const onTargetCount = comparable.filter((item) => item.status === "on_target").length;
  const attentionCount = comparable.filter((item) => item.status === "attention").length;
  const offTargetCount = comparable.filter((item) => item.status === "off_target").length;
  const overdueActions = data.actions.filter((item) => item.dueDate && item.dueDate < todayKey && !["completed", "cancelled"].includes(item.status)).length;
  const overdueInitiatives = data.initiatives.filter((item) => item.dueDate && item.dueDate < todayKey && !["completed", "cancelled"].includes(item.status)).length;
  const pendingRoutines = data.executions.filter((item) => item.status === "pending").length;
  const completedRoutines = data.executions.filter((item) => item.status === "completed").length;
  const closedRoutines = data.executions.filter((item) => ["completed", "blocked"].includes(item.status)).length;
  const pendingValidations = data.measurements.filter((item) => item.validationStatus === "pending").length;
  const actionProgress = averageProgress(data.actions);
  const initiativeProgress = averageProgress(data.initiatives);

  const objectivePerformance = data.objectives.filter((objective) => objective.status !== "cancelled").map((objective) => {
    const indicators = kpiPerformance.filter((item) => item.objectiveId === objective.id);
    const objectiveActions = data.actions.filter((item) => item.objectiveId === objective.id && item.status !== "cancelled");
    const objectiveInitiatives = data.initiatives.filter((item) => item.objectiveId === objective.id && item.status !== "cancelled");
    const objectiveComparable = indicators.filter((item) => ["on_target", "attention", "off_target"].includes(item.status));
    return {
      objectiveId: objective.id,
      title: objective.title,
      ownerName: objective.ownerName,
      status: objective.status,
      kpiCount: indicators.length,
      onTargetCount: objectiveComparable.filter((item) => item.status === "on_target").length,
      comparableCount: objectiveComparable.length,
      actionProgress: averageProgress(objectiveActions),
      initiativeProgress: averageProgress(objectiveInitiatives),
      overdueActions: objectiveActions.filter((item) => item.dueDate && item.dueDate < todayKey && !["completed", "cancelled"].includes(item.status)).length,
    };
  });

  const alerts = [
    offTargetCount ? { tone: "critical" as const, title: `${offTargetCount} KPI(s) fora da meta`, detail: "Priorize análise de causa e plano corretivo." } : null,
    overdueActions ? { tone: "critical" as const, title: `${overdueActions} ação(ões) atrasada(s)`, detail: "Revise responsáveis, impedimentos e novas datas." } : null,
    overdueInitiatives ? { tone: "warning" as const, title: `${overdueInitiatives} iniciativa(s) vencida(s)`, detail: "Atualize o status ou renegocie o prazo." } : null,
    pendingValidations ? { tone: "warning" as const, title: `${pendingValidations} medição(ões) aguardando validação`, detail: "Elas não entram no desempenho oficial até a conferência." } : null,
    kpiPerformance.filter((item) => item.status === "no_measurement").length ? { tone: "neutral" as const, title: `${kpiPerformance.filter((item) => item.status === "no_measurement").length} KPI(s) sem medição validada`, detail: "Registre e valide o realizado do período." } : null,
    data.actions.filter((item) => !item.ownerName || !item.dueDate).length ? { tone: "neutral" as const, title: `${data.actions.filter((item) => !item.ownerName || !item.dueDate).length} ação(ões) incompleta(s)`, detail: "Informe responsável e prazo para permitir acompanhamento." } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    activeObjectives: objectivePerformance.length,
    measuredKpis: latestByKpi.size,
    validatedKpis: latestValidatedByKpi.size,
    onTargetPercent: comparable.length ? Math.round(onTargetCount / comparable.length * 100) : null,
    onTargetCount,
    attentionCount,
    offTargetCount,
    overdueActions,
    overdueInitiatives,
    pendingRoutines,
    openInitiatives: data.initiatives.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
    actionProgress,
    initiativeProgress,
    routineCompletionPercent: closedRoutines ? Math.round(completedRoutines / closedRoutines * 100) : null,
    pendingValidations,
    kpiPerformance,
    objectivePerformance,
    actionCosts: costSummary(data.actions),
    initiativeCosts: costSummary(data.initiatives),
    alerts,
  };
}

export type ExecutiveDashboardData = ReturnType<typeof buildDashboard>;
