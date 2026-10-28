"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyAiSuggestion, decideAiSuggestion, requestAiAssistance, type AiApplicationKind, type AiMode } from "@/lib/ai-assistance";
import { getServerSession } from "@/lib/server-session";

async function userId() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session.user.id;
}

function destination(formData: FormData, flag: string) {
  return `/operacao?organizacao=${String(formData.get("organizationId"))}&ciclo=${String(formData.get("cycleId"))}&modulo=copiloto&${flag}=1`;
}

export async function requestAiAssistanceAction(formData: FormData) {
  await requestAiAssistance({
    userId: await userId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")),
    mode: String(formData.get("mode")) as AiMode, note: String(formData.get("note") ?? ""),
  });
  revalidatePath("/operacao");
  redirect(destination(formData, "gerado"));
}

export async function decideAiSuggestionAction(formData: FormData) {
  await decideAiSuggestion({
    userId: await userId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")),
    suggestionId: String(formData.get("suggestionId")), decision: String(formData.get("decision")) as "accepted" | "rejected", note: String(formData.get("note") ?? ""),
  });
  revalidatePath("/operacao");
  redirect(destination(formData, "decidido"));
}

export async function applyAiSuggestionAction(formData: FormData) {
  await applyAiSuggestion({
    userId: await userId(), organizationId: String(formData.get("organizationId")), cycleId: String(formData.get("cycleId")),
    suggestionId: String(formData.get("suggestionId")), applicationKind: String(formData.get("applicationKind")) as AiApplicationKind,
    openRevision: formData.get("openRevision") === "on", title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? ""),
    objectiveId: String(formData.get("objectiveId") ?? "") || undefined, ownerName: String(formData.get("ownerName") ?? ""), dueDate: String(formData.get("dueDate") ?? ""),
    priority: String(formData.get("priority") ?? "medium"), unit: String(formData.get("unit") ?? ""), source: String(formData.get("source") ?? ""),
    periodicity: String(formData.get("periodicity") ?? ""), direction: String(formData.get("direction") ?? ""), formula: String(formData.get("formula") ?? ""),
    baseline: String(formData.get("baseline") ?? ""), target: String(formData.get("target") ?? ""),
  });
  revalidatePath("/operacao");
  revalidatePath("/planejamento");
  redirect(destination(formData, "aplicado"));
}
