"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import {
  addActionItem,
  addKpi,
  addObjective,
  applyObjectiveTemplate,
  createCycle,
  formallyApprovePlan,
  saveBusinessPortrait,
  saveBusinessFacts,
  saveDiagnosisSignals,
  savePlanningSection,
  saveQuestionnaire,
  startPlanRevision,
  submitPlanForReview,
  technicalReviewPlan,
} from "@/lib/planning";
import { ANALYSIS_TOOLS, MATURITY_QUESTIONS, type AnalysisCode } from "@/lib/catalogs";
import { BUSINESS_FACT_CATALOG, DIAGNOSIS_SIGNAL_CATALOG } from "@/lib/inventory-catalog.generated";

async function currentUserId() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export async function createCycleAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  await createCycle({
    userId: await currentUserId(),
    organizationId,
    companyId: String(formData.get("companyId") ?? ""),
    name: String(formData.get("name") ?? ""),
    startYear: Number(formData.get("startYear")),
    endYear: Number(formData.get("endYear")),
  });
  revalidatePath("/");
  redirect(`/?organizacao=${organizationId}`);
}

export async function savePortraitAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  await saveBusinessPortrait({
    userId: await currentUserId(),
    organizationId,
    cycleId: String(formData.get("cycleId") ?? ""),
    businessDescription: String(formData.get("businessDescription") ?? ""),
    primaryCustomer: String(formData.get("primaryCustomer") ?? ""),
    valueProposition: String(formData.get("valueProposition") ?? ""),
    mainChallenge: String(formData.get("mainChallenge") ?? ""),
    expectedRevision: formData.has("expectedRevision") ? Number(formData.get("expectedRevision")) : undefined,
  });
  revalidatePath("/");
  redirect(formData.get("returnTo") === "planning" ? planUrl(formData, 1) : `/?organizacao=${organizationId}&salvo=1`);
}

const planUrl = (formData: FormData, phase: number, message = "salvo") => {
  const organizationId = String(formData.get("organizationId") ?? "");
  const cycleId = String(formData.get("cycleId") ?? "");
  return `/planejamento?organizacao=${organizationId}&ciclo=${cycleId}&fase=${phase}&${message}=1`;
};

export async function saveMaturityAction(formData: FormData) {
  const answers = Object.fromEntries(MATURITY_QUESTIONS.map(([code]) => {
    const raw = String(formData.get(code) ?? "");
    return [code, raw === "" ? null : Number(raw)];
  }));
  await saveQuestionnaire({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), questionnaireCode: "maturity", answers });
  revalidatePath("/planejamento");
  redirect(planUrl(formData, 2));
}

export async function saveBusinessFactsAction(formData: FormData) {
  const facts = Object.fromEntries(BUSINESS_FACT_CATALOG.map((item) => [item.code, {
    value: String(formData.get(`fact-${item.code}`) ?? ""),
    unavailable: formData.get(`unavailable-${item.code}`) === "on",
    confidence: String(formData.get(`confidence-${item.code}`) ?? "exact") as "exact" | "estimated" | "unavailable",
    sourceNote: String(formData.get(`source-${item.code}`) ?? ""),
    referenceDate: String(formData.get(`date-${item.code}`) ?? ""),
  }]));
  await saveBusinessFacts({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), facts });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 1));
}

export async function saveDiagnosisSignalsAction(formData: FormData) {
  const signals = Object.fromEntries(DIAGNOSIS_SIGNAL_CATALOG.map((item) => [item.code, {
    selected: formData.get(`signal-${item.code}`) === "on",
    intensity: String(formData.get(`intensity-${item.code}`) ?? "medium") as "low" | "medium" | "high",
    justification: String(formData.get(`justification-${item.code}`) ?? ""),
  }]));
  await saveDiagnosisSignals({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), signals });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 2));
}

export async function applyObjectiveTemplateAction(formData: FormData) {
  await applyObjectiveTemplate({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), objectiveCode: String(formData.get("objectiveCode")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 5, "aplicado"));
}

export async function saveAnalysisAction(formData: FormData) {
  const code = String(formData.get("questionnaireCode")) as AnalysisCode;
  const tool = ANALYSIS_TOOLS.find((item) => item.code === code);
  if (!tool) throw new Error("Questionário desconhecido.");
  const entries = tool.groups.flatMap((group) => group.items.flatMap((item) => tool.columns.map(([column]) => {
    const key = `${item.key}:${column}`;
    const raw = String(formData.get(key) ?? "");
    return [key, raw === "" ? null : Number(raw)] as const;
  })));
  await saveQuestionnaire({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), questionnaireCode: code, answers: Object.fromEntries(entries) });
  revalidatePath("/planejamento");
  redirect(planUrl(formData, 2));
}

export async function saveDirectionAction(formData: FormData) {
  await savePlanningSection({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), phase: "direction", data: { mission: String(formData.get("mission")), vision: String(formData.get("vision")), values: String(formData.get("values")), north: String(formData.get("north")), priorities: String(formData.get("priorities")), positioning: String(formData.get("positioning")) } });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 3));
}

export async function saveSwotAction(formData: FormData) {
  await savePlanningSection({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), phase: "swot", data: { strengths: String(formData.get("strengths")), weaknesses: String(formData.get("weaknesses")), opportunities: String(formData.get("opportunities")), threats: String(formData.get("threats")), origin: String(formData.get("origin")), justification: String(formData.get("justification")) } });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 4));
}

export async function addObjectiveAction(formData: FormData) {
  await addObjective({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), title: String(formData.get("title")), description: String(formData.get("description")), perspective: String(formData.get("perspective")), ownerName: String(formData.get("ownerName")), priority: String(formData.get("priority")), dueDate: String(formData.get("dueDate")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 5));
}

export async function addKpiAction(formData: FormData) {
  await addKpi({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), objectiveId: String(formData.get("objectiveId")), name: String(formData.get("name")), definition: String(formData.get("definition")), unit: String(formData.get("unit")), source: String(formData.get("source")), periodicity: String(formData.get("periodicity")), direction: String(formData.get("direction")), formula: String(formData.get("formula")), baseline: String(formData.get("baseline")), target: String(formData.get("target")), ownerName: String(formData.get("ownerName")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 5));
}

export async function addActionItemAction(formData: FormData) {
  await addActionItem({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")), objectiveId: String(formData.get("objectiveId")), kpiId: String(formData.get("kpiId")), title: String(formData.get("title")), description: String(formData.get("description")), why: String(formData.get("why")), how: String(formData.get("how")), location: String(formData.get("location")), ownerName: String(formData.get("ownerName")), startDate: String(formData.get("startDate")), dueDate: String(formData.get("dueDate")), priority: String(formData.get("priority")), plannedCost: String(formData.get("plannedCost")), origin: String(formData.get("origin")), originJustification: String(formData.get("originJustification")), dependencies: String(formData.get("dependencies")), risks: String(formData.get("risks")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 6));
}

export async function submitPlanAction(formData: FormData) {
  await submitPlanForReview({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 6, "enviado"));
}

export async function technicalReviewAction(formData: FormData) {
  await technicalReviewPlan({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 6, "revisado"));
}

export async function formalApprovalAction(formData: FormData) {
  await formallyApprovePlan({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 6, "aprovado"));
}

export async function startRevisionAction(formData: FormData) {
  await startPlanRevision({ userId: await currentUserId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")), expectedRevision: Number(formData.get("expectedRevision")) });
  revalidatePath("/planejamento"); redirect(planUrl(formData, 1, "reaberto"));
}
