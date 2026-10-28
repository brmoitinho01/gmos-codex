"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import {
  assignPersonToPosition, completeRoutineExecution, createInitiative, createOrganizationPerson,
  createOrganizationPosition, createRoutineTemplate, deriveActionFromInitiative,
  generateRoutineExecution, recordKpiMeasurement, transitionInitiative, validateKpiMeasurement,
} from "@/lib/inventory";

async function userId() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session.user.id;
}

const target = (form: FormData, module: string, flag = "salvo") => `/operacao?organizacao=${String(form.get("organizationId"))}&ciclo=${String(form.get("cycleId") ?? "")}&modulo=${module}&${flag}=1`;
const done = (form: FormData, module: string, flag?: string) => { revalidatePath("/operacao"); redirect(target(form, module, flag)); };

export async function recordMeasurementAction(form: FormData) {
  await recordKpiMeasurement({ userId: await userId(), organizationId: String(form.get("organizationId")), cycleId: String(form.get("cycleId")), kpiId: String(form.get("kpiId")), periodStart: String(form.get("periodStart")), periodEnd: String(form.get("periodEnd")), actualValue: String(form.get("actualValue")), evidence: String(form.get("evidence")), observation: String(form.get("observation")) });
  done(form, "indicadores");
}

export async function validateMeasurementAction(form: FormData) {
  await validateKpiMeasurement({ userId: await userId(), organizationId: String(form.get("organizationId")), measurementId: String(form.get("measurementId")), decision: String(form.get("decision")) as "validated" | "rejected" });
  done(form, "indicadores", "validado");
}

export async function createInitiativeAction(form: FormData) {
  await createInitiative({ userId: await userId(), organizationId: String(form.get("organizationId")), cycleId: String(form.get("cycleId")), objectiveId: String(form.get("objectiveId")), kpiId: String(form.get("kpiId")) || undefined, title: String(form.get("title")), description: String(form.get("description")), expectedResult: String(form.get("expectedResult")), ownerName: String(form.get("ownerName")), sponsorName: String(form.get("sponsorName")), startDate: String(form.get("startDate")), dueDate: String(form.get("dueDate")), priority: String(form.get("priority")), plannedCost: String(form.get("plannedCost")) });
  done(form, "iniciativas");
}

export async function transitionInitiativeAction(form: FormData) {
  await transitionInitiative({ userId: await userId(), organizationId: String(form.get("organizationId")), initiativeId: String(form.get("initiativeId")), nextStatus: String(form.get("nextStatus")) as "in_review" | "approved" | "active" | "on_hold" | "completed" | "cancelled" });
  done(form, "iniciativas", "transicao");
}

export async function deriveActionAction(form: FormData) {
  await deriveActionFromInitiative({ userId: await userId(), organizationId: String(form.get("organizationId")), initiativeId: String(form.get("initiativeId")) });
  done(form, "iniciativas", "derivado");
}

export async function createRoutineAction(form: FormData) {
  await createRoutineTemplate({ userId: await userId(), organizationId: String(form.get("organizationId")), cycleId: String(form.get("cycleId")) || undefined, name: String(form.get("name")), description: String(form.get("description")), frequency: String(form.get("frequency")), responsibleUserId: String(form.get("responsibleUserId")) || undefined, responsibleName: String(form.get("responsibleName")), startDate: String(form.get("startDate")), weekday: form.get("weekday") ? Number(form.get("weekday")) : undefined, monthday: form.get("monthday") ? Number(form.get("monthday")) : undefined, customIntervalDays: form.get("customIntervalDays") ? Number(form.get("customIntervalDays")) : undefined, timeOfDay: String(form.get("timeOfDay")), evidenceRequired: form.get("evidenceRequired") === "on" });
  done(form, "rotinas");
}

export async function generateRoutineAction(form: FormData) {
  await generateRoutineExecution({ userId: await userId(), organizationId: String(form.get("organizationId")), templateId: String(form.get("templateId")), dueDate: String(form.get("dueDate")) });
  done(form, "rotinas", "gerado");
}

export async function completeRoutineAction(form: FormData) {
  await completeRoutineExecution({ userId: await userId(), organizationId: String(form.get("organizationId")), executionId: String(form.get("executionId")), evidence: String(form.get("evidence")), observation: String(form.get("observation")), impediment: String(form.get("impediment")) });
  done(form, "trabalho", "executado");
}

export async function createPersonAction(form: FormData) {
  await createOrganizationPerson({ userId: await userId(), organizationId: String(form.get("organizationId")), name: String(form.get("name")), email: String(form.get("email")), employeeCode: String(form.get("employeeCode")) });
  done(form, "estrutura");
}

export async function createPositionAction(form: FormData) {
  await createOrganizationPosition({ userId: await userId(), organizationId: String(form.get("organizationId")), title: String(form.get("title")), purpose: String(form.get("purpose")), responsibilities: String(form.get("responsibilities")), authority: String(form.get("authority")), deliverables: String(form.get("deliverables")), parentPositionId: String(form.get("parentPositionId")) || undefined, expectedHolders: Number(form.get("expectedHolders")) || 1 });
  done(form, "estrutura");
}

export async function assignPositionAction(form: FormData) {
  await assignPersonToPosition({ userId: await userId(), organizationId: String(form.get("organizationId")), positionId: String(form.get("positionId")), personId: String(form.get("personId")), assignmentType: String(form.get("assignmentType")), startsAt: String(form.get("startsAt")), notes: String(form.get("notes")) });
  done(form, "estrutura", "atribuido");
}
