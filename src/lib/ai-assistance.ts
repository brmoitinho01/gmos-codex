import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  actionItems,
  aiAssistanceRuns,
  aiSuggestionApplications,
  aiSuggestions,
  auditLogs,
  strategicCycles,
  strategicKpis,
  strategicObjectives,
} from "@/db/schema";
import { requireCapability } from "./authorization";
import { getPlanData } from "./planning";

export const AI_MODES = ["plan_review", "objectives_kpis", "action_plan"] as const;
export type AiMode = typeof AI_MODES[number];
export const AI_APPLICATION_KINDS = ["objective", "kpi", "action"] as const;
export type AiApplicationKind = typeof AI_APPLICATION_KINDS[number];

const PROMPT_VERSION = "gmos-strategy-v1";
const suggestionSchema = z.object({
  summary: z.string().min(1).max(1200),
  suggestions: z.array(z.object({
    category: z.enum(["diagnosis", "direction", "objective", "kpi", "action", "risk", "governance"]),
    title: z.string().min(1).max(200),
    recommendation: z.string().min(1).max(3000),
    rationale: z.string().min(1).max(2000),
    risks: z.array(z.string().max(500)).max(8),
    nextSteps: z.array(z.string().max(500)).max(8),
  })).min(1).max(8),
});

type SuggestionResult = z.infer<typeof suggestionSchema>;

const structuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "suggestions"],
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "recommendation", "rationale", "risks", "nextSteps"],
        properties: {
          category: { type: "string", enum: ["diagnosis", "direction", "objective", "kpi", "action", "risk", "governance"] },
          title: { type: "string" },
          recommendation: { type: "string" },
          rationale: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          nextSteps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const modeInstructions: Record<AiMode, string> = {
  plan_review: "Revise a coerência do plano, sua rastreabilidade ao diagnóstico, lacunas, riscos e governança.",
  objectives_kpis: "Sugira melhorias em objetivos e KPIs. Cada KPI deve ter definição, fórmula, fonte, periodicidade e direção claras. Não invente metas numéricas.",
  action_plan: "Sugira melhorias no plano de ação, com responsáveis, prazos, dependências, riscos e critérios de evidência. Não invente custos.",
};

function truncate(value: unknown, length = 1500) {
  if (typeof value !== "string") return value;
  return value.slice(0, length)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REMOVIDO]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF_REMOVIDO]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, "[CNPJ_REMOVIDO]");
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[CONTEUDO_OMITIDO]";
  if (typeof value === "string") return truncate(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [key, sanitizeValue(item, depth + 1)]));
  return value;
}

function sanitizedContext(plan: Awaited<ReturnType<typeof getPlanData>>) {
  const direction = plan.sections.find((item) => item.phase === "direction")?.data ?? {};
  const swot = plan.sections.find((item) => item.phase === "swot")?.data ?? {};
  return {
    cycle: { name: plan.cycle.name, startYear: plan.cycle.startYear, endYear: plan.cycle.endYear, workflowStatus: plan.cycle.workflowStatus, revision: plan.cycle.revision },
    portrait: plan.portrait ? {
      businessDescription: truncate(plan.portrait.businessDescription),
      primaryCustomer: truncate(plan.portrait.primaryCustomer),
      valueProposition: truncate(plan.portrait.valueProposition),
      mainChallenge: truncate(plan.portrait.mainChallenge),
    } : null,
    direction: sanitizeValue(direction),
    swot: sanitizeValue(swot),
    facts: plan.facts.slice(0, 40).map((item) => ({ code: item.code, value: sanitizeValue(item.value), unavailable: item.unavailable, confidence: item.confidence, referenceDate: item.referenceDate })),
    signals: plan.signals.filter((item) => item.selected).slice(0, 30).map((item) => ({ code: item.code, dimension: item.dimension, quadrant: item.quadrant, intensity: item.intensity, justification: truncate(item.justification, 600) })),
    objectives: plan.objectives.slice(0, 30).map((item) => ({ id: item.id, title: item.title, description: truncate(item.description), perspective: item.perspective, priority: item.priority, dueDate: item.dueDate, status: item.status })),
    kpis: plan.kpis.slice(0, 80).map((item) => ({ objectiveId: item.objectiveId, name: item.name, definition: truncate(item.definition, 800), unit: item.unit, source: item.source, periodicity: item.periodicity, direction: item.direction, formula: item.formula, baseline: item.baseline, target: item.target })),
    actions: plan.actions.slice(0, 80).map((item) => ({ objectiveId: item.objectiveId, kpiId: item.kpiId, title: item.title, description: truncate(item.description, 800), why: truncate(item.why, 600), how: truncate(item.how, 800), dueDate: item.dueDate, priority: item.priority, status: item.status, progress: item.progress, dependencies: truncate(item.dependencies, 600), risks: truncate(item.risks, 600) })),
  };
}

export function getAiConfiguration() {
  const provider = process.env.GMOS_AI_PROVIDER ?? "disabled";
  if (provider === "local_preview") return { provider, model: "simulacao-local", ready: true, external: false, label: "Simulação local — não utiliza modelo de IA" };
  if (provider === "openai") {
    const model = process.env.GMOS_AI_MODEL?.trim() ?? "";
    const ready = Boolean(process.env.OPENAI_API_KEY?.trim() && model);
    return { provider, model: model || "não configurado", ready, external: true, label: ready ? `OpenAI · ${model}` : "OpenAI — chave e modelo não configurados" };
  }
  return { provider: "disabled", model: "nenhum", ready: false, external: false, label: "Copiloto desativado" };
}

function localPreview(plan: Awaited<ReturnType<typeof getPlanData>>, mode: AiMode): SuggestionResult {
  const suggestions: SuggestionResult["suggestions"] = [];
  const kpisWithoutTarget = plan.kpis.filter((item) => !item.target || !Number.isFinite(Number(item.target.replace(",", ".")))).length;
  const actionsWithoutOwnerOrDate = plan.actions.filter((item) => !item.ownerName || !item.dueDate).length;
  if (mode === "objectives_kpis" || mode === "plan_review") suggestions.push({ category: "kpi", title: "Homologar metas e linhas de base", recommendation: `Revisar os ${kpisWithoutTarget} indicador(es) sem meta numérica homologada e registrar fonte, responsável e data de referência.`, rationale: "Sem linha de base e meta validada, o painel não consegue comparar planejado e executado.", risks: ["Metas arbitrárias podem induzir decisões incorretas."], nextSteps: ["Validar a fonte do dado.", "Definir baseline antes da meta.", "Submeter a meta à aprovação do gestor."] });
  if (mode === "action_plan" || mode === "plan_review") suggestions.push({ category: "action", title: "Completar governança das ações", recommendation: `Completar responsável e prazo das ${actionsWithoutOwnerOrDate} ação(ões) com campos incompletos e definir evidência de conclusão.`, rationale: "A execução só pode ser cobrada quando há dono, prazo e critério verificável.", risks: ["Atribuições nominais sem aceite podem gerar falsa responsabilização."], nextSteps: ["Confirmar responsável.", "Definir prazo realista.", "Registrar evidência esperada."] });
  if (!suggestions.length) suggestions.push({ category: "governance", title: "Instituir revisão estratégica mensal", recommendation: "Criar um ritual mensal para validar medições, revisar desvios e registrar decisões corretivas.", rationale: "A cadência liga planejamento e execução sem depender de atualizações ocasionais.", risks: ["Reuniões sem dados validados podem virar apenas relato de atividades."], nextSteps: ["Definir pauta padrão.", "Nomear facilitador.", "Registrar decisões no GMOS."] });
  return suggestionSchema.parse({ summary: "Prévia determinística para validar o fluxo. Não foi produzida por modelo de IA.", suggestions });
}

async function callOpenAi(context: unknown, mode: AiMode, note: string) {
  const configuration = getAiConfiguration();
  if (configuration.provider !== "openai" || !configuration.ready) throw new Error("Provedor OpenAI não está completamente configurado.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: configuration.model,
      store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: "Você é um copiloto de planejamento estratégico. Trabalhe somente com o contexto fornecido. Diferencie fatos, lacunas e recomendações; não invente números, pessoas, custos ou resultados. Produza sugestões para revisão humana, nunca decisões automáticas." }] },
        { role: "user", content: [{ type: "input_text", text: `${modeInstructions[mode]}\nObservação do usuário: ${note || "nenhuma"}\nContexto estruturado: ${JSON.stringify(context)}` }] },
      ],
      text: { format: { type: "json_schema", name: "gmos_strategic_suggestions", strict: true, schema: structuredOutputSchema } },
    }),
  });
  const body = await response.json() as { id?: string; error?: { message?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>; usage?: Record<string, number> };
  if (!response.ok) throw new Error(body.error?.message || `Falha do provedor (${response.status}).`);
  const content = body.output?.flatMap((item) => item.content ?? []) ?? [];
  const refusal = content.find((item) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`O modelo recusou a solicitação: ${refusal}`);
  const outputText = content.find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("O provedor não retornou sugestões estruturadas.");
  return { result: suggestionSchema.parse(JSON.parse(outputText)), metadata: { responseId: body.id, usage: body.usage, requestId: response.headers.get("x-request-id") } };
}

export async function requestAiAssistance(input: { userId: string; organizationId: string; cycleId: string; mode: AiMode; note?: string }) {
  await requireCapability(input.userId, input.organizationId, "ai.request", "Sem permissão para solicitar assistência de IA.");
  if (!AI_MODES.includes(input.mode)) throw new Error("Modo de assistência desconhecido.");
  const configuration = getAiConfiguration();
  if (!configuration.ready) throw new Error("O copiloto está desativado ou incompletamente configurado.");
  const plan = await getPlanData(input.userId, input.organizationId, input.cycleId);
  const context = sanitizedContext(plan);
  const serialized = JSON.stringify(context);
  const contextHash = createHash("sha256").update(serialized).digest("hex");
  const [run] = await db.insert(aiAssistanceRuns).values({
    organizationId: input.organizationId, cycleId: input.cycleId, requestedBy: input.userId, mode: input.mode,
    provider: configuration.provider, model: configuration.model, promptVersion: PROMPT_VERSION, contextHash,
    contextSummary: { objectiveCount: plan.objectives.length, kpiCount: plan.kpis.length, actionCount: plan.actions.length, factCount: plan.facts.length, selectedSignalCount: plan.signals.filter((item) => item.selected).length },
  }).returning();
  try {
    const generated = configuration.provider === "local_preview"
      ? { result: localPreview(plan, input.mode), metadata: { simulated: true } }
      : await callOpenAi(context, input.mode, input.note?.trim().slice(0, 1000) ?? "");
    await db.transaction(async (tx) => {
      for (const suggestion of generated.result.suggestions) await tx.insert(aiSuggestions).values({
        runId: run.id, organizationId: input.organizationId, cycleId: input.cycleId, category: suggestion.category,
        title: suggestion.title, recommendation: suggestion.recommendation, rationale: suggestion.rationale,
        payload: { risks: suggestion.risks, nextSteps: suggestion.nextSteps },
      });
      await tx.update(aiAssistanceRuns).set({ status: "completed", finishedAt: new Date(), responseMetadata: { ...generated.metadata, summary: generated.result.summary, suggestionCount: generated.result.suggestions.length } }).where(eq(aiAssistanceRuns.id, run.id));
      await tx.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "ai.assistance_completed", entityType: "ai_assistance_run", entityId: run.id, metadata: { mode: input.mode, provider: configuration.provider, model: configuration.model, suggestionCount: generated.result.suggestions.length } });
    });
    return run.id;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Falha desconhecida.";
    await db.update(aiAssistanceRuns).set({ status: "failed", finishedAt: new Date(), errorMessage: message }).where(eq(aiAssistanceRuns.id, run.id));
    await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: "ai.assistance_failed", entityType: "ai_assistance_run", entityId: run.id, metadata: { mode: input.mode, provider: configuration.provider } });
    throw new Error(message);
  }
}

export async function decideAiSuggestion(input: { userId: string; organizationId: string; cycleId: string; suggestionId: string; decision: "accepted" | "rejected"; note?: string }) {
  await requireCapability(input.userId, input.organizationId, "ai.decide", "Sem permissão para decidir sugestões de IA.");
  const [suggestion] = await db.update(aiSuggestions).set({ status: input.decision, decidedBy: input.userId, decidedAt: new Date(), decisionNote: input.note?.trim().slice(0, 1000) || null }).where(and(eq(aiSuggestions.id, input.suggestionId), eq(aiSuggestions.organizationId, input.organizationId), eq(aiSuggestions.cycleId, input.cycleId), eq(aiSuggestions.status, "pending"))).returning();
  if (!suggestion) throw new Error("Sugestão pendente não encontrada neste escopo.");
  await db.insert(auditLogs).values({ actorUserId: input.userId, organizationId: input.organizationId, action: `ai.suggestion_${input.decision}`, entityType: "ai_suggestion", entityId: suggestion.id, metadata: { runId: suggestion.runId } });
  return suggestion;
}

type ApplyAiSuggestionInput = {
  userId: string;
  organizationId: string;
  cycleId: string;
  suggestionId: string;
  applicationKind: AiApplicationKind;
  openRevision?: boolean;
  title: string;
  description?: string;
  objectiveId?: string;
  ownerName?: string;
  dueDate?: string;
  priority?: string;
  unit?: string;
  source?: string;
  periodicity?: string;
  direction?: string;
  formula?: string;
  baseline?: string;
  target?: string;
};

const clean = (value: string | undefined, length: number) => value?.trim().slice(0, length) || null;

export async function applyAiSuggestion(input: ApplyAiSuggestionInput) {
  await requireCapability(input.userId, input.organizationId, "ai.decide", "Sem permissão para aplicar sugestões de IA.");
  await requireCapability(input.userId, input.organizationId, "planning.write", "Sem permissão para editar o planejamento.");
  if (!AI_APPLICATION_KINDS.includes(input.applicationKind)) throw new Error("Tipo de aplicação desconhecido.");
  const title = clean(input.title, 200);
  if (!title) throw new Error("Revise e informe um título antes de aplicar a sugestão.");
  if (["kpi", "action"].includes(input.applicationKind) && !input.objectiveId) throw new Error("Selecione o objetivo relacionado.");
  if (input.applicationKind === "kpi" && ![input.unit, input.source, input.periodicity, input.direction, input.formula].every((value) => value?.trim())) {
    throw new Error("Para criar um KPI, informe unidade, fonte, periodicidade, direção e fórmula.");
  }

  return db.transaction(async (tx) => {
    const [suggestion] = await tx.select().from(aiSuggestions).where(and(
      eq(aiSuggestions.id, input.suggestionId),
      eq(aiSuggestions.organizationId, input.organizationId),
      eq(aiSuggestions.cycleId, input.cycleId),
    )).limit(1);
    if (!suggestion) throw new Error("Sugestão não encontrada neste escopo.");
    if (suggestion.status === "applied") throw new Error("Esta sugestão já foi aplicada.");
    if (suggestion.status !== "accepted") throw new Error("Somente sugestões aceitas podem ser aplicadas.");

    const [cycle] = await tx.select().from(strategicCycles).where(and(
      eq(strategicCycles.id, input.cycleId),
      eq(strategicCycles.organizationId, input.organizationId),
    )).limit(1);
    if (!cycle) throw new Error("Ciclo não encontrado neste escopo.");
    if (["in_review", "awaiting_approval"].includes(cycle.workflowStatus)) throw new Error("O plano está em revisão e não pode receber alterações.");
    if (cycle.workflowStatus === "approved" && !input.openRevision) throw new Error("Confirme a abertura de uma nova revisão para alterar um plano aprovado.");

    if (input.objectiveId) {
      const [objective] = await tx.select({ id: strategicObjectives.id }).from(strategicObjectives).where(and(
        eq(strategicObjectives.id, input.objectiveId),
        eq(strategicObjectives.organizationId, input.organizationId),
        eq(strategicObjectives.cycleId, input.cycleId),
      )).limit(1);
      if (!objective) throw new Error("Objetivo relacionado não encontrado neste escopo.");
    }

    const openedRevision = cycle.workflowStatus === "approved";
    const [updatedCycle] = await tx.update(strategicCycles).set({
      revision: cycle.revision + 1,
      workflowStatus: openedRevision ? "under_revision" : cycle.workflowStatus,
      updatedAt: new Date(),
    }).where(and(eq(strategicCycles.id, cycle.id), eq(strategicCycles.revision, cycle.revision))).returning();
    if (!updatedCycle) throw new Error("O plano foi alterado por outra sessão. Recarregue antes de aplicar.");

    const description = clean(input.description, 3000) ?? "";
    const ownerName = clean(input.ownerName, 160);
    const dueDate = clean(input.dueDate, 10);
    const priority = clean(input.priority, 20) ?? "medium";
    let entity: { id: string };
    let entityType: "strategic_objective" | "strategic_kpi" | "action_item";

    if (input.applicationKind === "objective") {
      [entity] = await tx.insert(strategicObjectives).values({
        organizationId: input.organizationId, cycleId: input.cycleId, title, description,
        ownerName, dueDate, priority, createdBy: input.userId,
      }).returning({ id: strategicObjectives.id });
      entityType = "strategic_objective";
    } else if (input.applicationKind === "kpi") {
      [entity] = await tx.insert(strategicKpis).values({
        organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: input.objectiveId!,
        name: title, definition: description, unit: clean(input.unit, 40)!, source: clean(input.source, 160)!,
        periodicity: clean(input.periodicity, 40)!, direction: clean(input.direction, 20)!, formula: clean(input.formula, 3000)!,
        baseline: clean(input.baseline, 60), target: clean(input.target, 60), ownerName, createdBy: input.userId,
      }).returning({ id: strategicKpis.id });
      entityType = "strategic_kpi";
    } else {
      [entity] = await tx.insert(actionItems).values({
        organizationId: input.organizationId, cycleId: input.cycleId, objectiveId: input.objectiveId!,
        title, description, why: suggestion.rationale, ownerName, dueDate, priority,
        origin: "ai_suggestion", originJustification: `Sugestão ${suggestion.id} da análise ${suggestion.runId}`,
        createdBy: input.userId,
      }).returning({ id: actionItems.id });
      entityType = "action_item";
    }

    const snapshot = {
      title, description, objectiveId: input.objectiveId ?? null, ownerName, dueDate, priority,
      ...(input.applicationKind === "kpi" ? {
        unit: clean(input.unit, 40), source: clean(input.source, 160), periodicity: clean(input.periodicity, 40),
        direction: clean(input.direction, 20), formula: clean(input.formula, 3000), baseline: clean(input.baseline, 60), target: clean(input.target, 60),
      } : {}),
    };
    const [application] = await tx.insert(aiSuggestionApplications).values({
      suggestionId: suggestion.id, organizationId: input.organizationId, cycleId: input.cycleId,
      applicationKind: input.applicationKind, entityType, entityId: entity.id, sourceRevision: cycle.revision,
      openedRevision, appliedBy: input.userId, applicationSnapshot: snapshot,
    }).returning();
    await tx.update(aiSuggestions).set({ status: "applied" }).where(eq(aiSuggestions.id, suggestion.id));
    await tx.insert(auditLogs).values({
      actorUserId: input.userId, organizationId: input.organizationId, action: "ai.suggestion_applied",
      entityType, entityId: entity.id,
      metadata: { suggestionId: suggestion.id, runId: suggestion.runId, applicationKind: input.applicationKind, sourceRevision: cycle.revision, resultingRevision: updatedCycle.revision, openedRevision },
    });
    return { application, entity, cycle: updatedCycle };
  });
}

export async function getAiWorkspace(userId: string, organizationId: string, cycleId: string) {
  await requireCapability(userId, organizationId, "report.read");
  const [runs, suggestions] = await Promise.all([
    db.select().from(aiAssistanceRuns).where(and(eq(aiAssistanceRuns.organizationId, organizationId), eq(aiAssistanceRuns.cycleId, cycleId))).orderBy(desc(aiAssistanceRuns.startedAt)).limit(12),
    db.select().from(aiSuggestions).where(and(eq(aiSuggestions.organizationId, organizationId), eq(aiSuggestions.cycleId, cycleId))).orderBy(desc(aiSuggestions.createdAt)).limit(60),
  ]);
  return { configuration: getAiConfiguration(), runs, suggestions };
}
