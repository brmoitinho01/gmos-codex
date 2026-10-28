import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { client, db } from "@/db";
import { migrateDatabase } from "@/db/migrate";
import { INITIAL_ORGANIZATIONS, seedOrganizations } from "@/db/seed";
import {
  actionItems,
  aiSuggestionApplications,
  businessPortraits,
  companies,
  memberships,
  invitations,
  organizations,
  planVersions,
  sessions,
  strategicCycles,
  userProfiles,
  users,
  verifications,
} from "@/db/schema";
import { auth, createAuth } from "./auth";
import {
  addActionItem,
  addKpi,
  addObjective,
  createCycle,
  formallyApprovePlan,
  getPlanData,
  applyObjectiveTemplate,
  saveBusinessFacts,
  saveBusinessPortrait,
  saveDiagnosisSignals,
  savePlanningSection,
  saveQuestionnaire,
  startPlanRevision,
  submitPlanForReview,
  technicalReviewPlan,
} from "./planning";
import { MATURITY_QUESTIONS } from "./catalogs";
import { BUSINESS_FACT_CATALOG, DIAGNOSIS_SIGNAL_CATALOG, KPI_TEMPLATES, OBJECTIVE_TEMPLATES } from "./inventory-catalog.generated";
import {
  assignPersonToPosition,
  buildDashboard,
  completeRoutineExecution,
  createInitiative,
  createOrganizationPerson,
  createOrganizationPosition,
  createRoutineTemplate,
  deriveActionFromInitiative,
  generateRoutineExecution,
  getInventoryWorkspace,
  parseDashboardNumber,
  recordKpiMeasurement,
  transitionInitiative,
  validateKpiMeasurement,
} from "./inventory";
import { acceptInvitation, prepareInvitation, revokeMembership } from "./access";
import { roleHasCapability } from "./authorization";
import { buildAuthorizedExport } from "./export";
import { applyAiSuggestion, decideAiSuggestion, getAiWorkspace, requestAiAssistance } from "./ai-assistance";

const password = "Teste-local-seguro-123!";
let userId = "";
let organizationA = "";
let organizationB = "";
let companyA = "";

beforeAll(async () => {
  await client.exec("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrateDatabase();
  await seedOrganizations();
  await seedOrganizations();

  const bootstrapAuth = createAuth({ allowSignUp: true });
  const registered = await bootstrapAuth.api.signUpEmail({
    body: { email: "admin.test@gmos.local", name: "Administrador de Teste", password },
  });
  userId = registered.user.id;
  await db.insert(userProfiles).values({ userId });

  const seeded = await db.select().from(organizations).orderBy(organizations.slug);
  organizationA = seeded[0].id;
  organizationB = seeded[1].id;
  const [rootCompany] = await db.select().from(companies).where(and(
    eq(companies.organizationId, organizationA),
    eq(companies.isRoot, true),
  ));
  companyA = rootCompany.id;
  await db.insert(memberships).values({ userId, organizationId: organizationA, role: "group_admin" });
});

afterAll(async () => {
  await client.close();
});

async function login() {
  return auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin.test@gmos.local", password }),
  }));
}

describe("Entrega 1", () => {
  it("prepara exatamente seis organizações sem duplicar", async () => {
    const rows = await db.select().from(organizations);
    expect(rows).toHaveLength(6);
    expect(rows.map((item) => item.name).sort()).toEqual(INITIAL_ORGANIZATIONS.map((item) => item.name).sort());
  });

  it("bloqueia cadastro público e aceita login individual", async () => {
    await expect(auth.api.signUpEmail({
      body: { email: "visitante@gmos.local", name: "Visitante", password },
    })).rejects.toThrow();
    const response = await login();
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("session_token");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe("admin.test@gmos.local");
  });

  it("salva, encerra sessão, entra novamente e recupera o mesmo retrato", async () => {
    const firstLogin = await login();
    const cookie = firstLogin.headers.get("set-cookie")!;
    const sessionCountBeforeSignOut = (await db.select().from(sessions)).length;
    const cycle = await createCycle({
      userId,
      organizationId: organizationA,
      companyId: companyA,
      name: "Ciclo de Teste 2027–2029",
      startYear: 2027,
      endYear: 2029,
    });
    const saved = await saveBusinessPortrait({
      userId,
      organizationId: organizationA,
      cycleId: cycle.id,
      businessDescription: "Conteúdo persistente de verificação",
      primaryCustomer: "Cliente de teste",
      valueProposition: "Previsibilidade",
      mainChallenge: "Execução",
    });

    const signOut = await auth.handler(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    }));
    expect(signOut.status).toBe(200);
    expect(await db.select().from(sessions)).toHaveLength(sessionCountBeforeSignOut - 1);

    const secondLogin = await login();
    expect(secondLogin.status).toBe(200);
    const [reloaded] = await db.select().from(businessPortraits).where(eq(businessPortraits.cycleId, cycle.id));
    expect(reloaded.businessDescription).toBe(saved.businessDescription);
    expect(reloaded.updatedBy).toBe(userId);
  });

  it("nega escrita cruzada em organização não atribuída", async () => {
    const [foreignCompany] = await db.select().from(companies).where(eq(companies.organizationId, organizationB));
    await expect(createCycle({
      userId,
      organizationId: organizationB,
      companyId: foreignCompany.id,
      name: "Tentativa indevida",
      startYear: 2027,
      endYear: 2029,
    })).rejects.toThrow("Acesso negado");
  });

});

describe("Entrega 2", () => {
  it("não envia planejamento parcial para revisão", async () => {
    const cycle = await createCycle({ userId, organizationId: organizationA, companyId: companyA, name: "Ciclo Parcial", startYear: 2030, endYear: 2031 });
    await expect(submitPlanForReview({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: 0 })).rejects.toThrow("Complete as seis fases");
  });

  it("percorre seis fases, revisa, aprova, fotografa e preserva a versão oficial", async () => {
    const cycle = await createCycle({ userId, organizationId: organizationA, companyId: companyA, name: "Ciclo Completo", startYear: 2032, endYear: 2034 });
    let revision = 0;
    await saveBusinessPortrait({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, businessDescription: "Operação fictícia", primaryCustomer: "Empresas regionais", valueProposition: "Previsibilidade", mainChallenge: "Escala" });
    await saveQuestionnaire({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, questionnaireCode: "maturity", answers: Object.fromEntries(MATURITY_QUESTIONS.map(([code]) => [code, 3])) });
    await saveQuestionnaire({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, questionnaireCode: "pest", answers: { "politico_1:op": 4 } });
    await savePlanningSection({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, phase: "direction", data: { mission: "Entregar previsibilidade", vision: "Crescer com controle", values: "Ética, disciplina e respeito", north: "Escalar a operação", priorities: "Operações", positioning: "Parceiro confiável" } });
    await savePlanningSection({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, phase: "swot", data: { strengths: "Equipe", weaknesses: "Processos", opportunities: "Demanda", threats: "Custos", origin: "Liderança", justification: "Oficina" } });

    const objectiveIds: string[] = [];
    for (const title of ["Elevar margem", "Padronizar operação", "Aumentar satisfação"]) {
      const objective = await addObjective({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, title, ownerName: "Gestor fictício", priority: "high", dueDate: "2033-12-31" });
      objectiveIds.push(objective.id);
    }
    for (const [index, objectiveId] of objectiveIds.entries()) {
      await addKpi({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, objectiveId, name: `KPI ${index + 1}`, unit: "%", source: "Sistema fictício", periodicity: "mensal", direction: "higher", formula: "realizado / meta", baseline: "não informado", target: "não informada", ownerName: "Gestor fictício" });
      await addActionItem({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++, objectiveId, title: `Ação ${index + 1}`, ownerName: "Gestor fictício", dueDate: "2033-06-30", priority: "high" });
    }
    const submitted = await submitPlanForReview({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision++ });
    expect(submitted.workflowStatus).toBe("in_review");

    const bootstrapAuth = createAuth({ allowSignUp: true });
    const consultant = await bootstrapAuth.api.signUpEmail({ body: { email: "consultor.test@gmos.local", name: "Consultor Fictício", password } });
    await db.insert(userProfiles).values({ userId: consultant.user.id });
    await db.insert(memberships).values({ userId: consultant.user.id, organizationId: organizationA, role: "consultant" });
    await technicalReviewPlan({ userId: consultant.user.id, organizationId: organizationA, cycleId: cycle.id });
    const approved = await formallyApprovePlan({ userId, organizationId: organizationA, cycleId: cycle.id });
    expect(approved.version.versionNumber).toBe(1);
    expect(approved.cycle.workflowStatus).toBe("approved");
    await expect(savePlanningSection({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision, phase: "direction", data: { mission: "Mudança indevida" } })).rejects.toThrow("bloqueada");

    const reopened = await startPlanRevision({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: revision });
    expect(reopened.workflowStatus).toBe("under_revision");
    await savePlanningSection({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: reopened.revision, phase: "direction", data: { mission: "Nova missão em revisão", vision: "Nova visão", values: "Ética, disciplina e respeito", north: "Novo norte", priorities: "Finanças", positioning: "Em revisão" } });
    await expect(savePlanningSection({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: reopened.revision, phase: "direction", data: { mission: "Concorrente" } })).rejects.toThrow("outra sessão");
    const [official] = await db.select().from(planVersions).where(eq(planVersions.id, approved.version.id));
    const snapshot = official.snapshot as { sections: { phase: string; data: Record<string, string> }[] };
    expect(snapshot.sections.find((item) => item.phase === "direction")?.data.mission).toBe("Entregar previsibilidade");

    const livePlan = await getPlanData(userId, organizationA, cycle.id);
    const measurement = await recordKpiMeasurement({ userId, organizationId: organizationA, cycleId: cycle.id, kpiId: livePlan.kpis[0].id, periodStart: "2033-01-01", periodEnd: "2033-01-31", actualValue: "0", evidence: "Fechamento fictício" });
    expect(measurement.actualValue).toBe("0");
    expect((measurement.definitionSnapshot as { formula: string }).formula).toBe("realizado / meta");
    expect((await validateKpiMeasurement({ userId, organizationId: organizationA, measurementId: measurement.id, decision: "validated" })).validationStatus).toBe("validated");

    const initiative = await createInitiative({ userId, organizationId: organizationA, cycleId: cycle.id, objectiveId: livePlan.objectives[0].id, kpiId: livePlan.kpis[0].id, title: "Iniciativa fictícia", expectedResult: "Melhorar o indicador", ownerName: "Gestor fictício", dueDate: "2033-08-31" });
    await transitionInitiative({ userId, organizationId: organizationA, initiativeId: initiative.id, nextStatus: "in_review" });
    await transitionInitiative({ userId, organizationId: organizationA, initiativeId: initiative.id, nextStatus: "approved" });
    const derived = await deriveActionFromInitiative({ userId, organizationId: organizationA, initiativeId: initiative.id });
    expect(derived.origin).toBe("initiative");
    await expect(deriveActionFromInitiative({ userId, organizationId: organizationA, initiativeId: initiative.id })).rejects.toThrow("Já existe ação viva");

    const routine = await createRoutineTemplate({ userId, organizationId: organizationA, cycleId: cycle.id, name: "Fechamento mensal", frequency: "monthly", responsibleUserId: userId, responsibleName: "Administrador de Teste", startDate: "2033-01-01", monthday: 5, evidenceRequired: true });
    const execution = await generateRoutineExecution({ userId, organizationId: organizationA, templateId: routine.id, dueDate: "2033-02-05" });
    const completed = await completeRoutineExecution({ userId, organizationId: organizationA, executionId: execution.id, evidence: "Ata fictícia" });
    expect(completed.status).toBe("completed");

    const person = await createOrganizationPerson({ userId, organizationId: organizationA, name: "Pessoa Fictícia" });
    const position = await createOrganizationPosition({ userId, organizationId: organizationA, title: "Gerência Fictícia", purpose: "Testar organograma" });
    const assignment = await assignPersonToPosition({ userId, organizationId: organizationA, personId: person.id, positionId: position.id, startsAt: "2033-01-01" });
    expect(assignment.organizationId).toBe(organizationA);
    const inventory = await getInventoryWorkspace(userId, organizationA, cycle.id);
    const dashboard = buildDashboard(inventory, new Date("2033-07-01T12:00:00Z"));
    expect(dashboard.measuredKpis).toBe(1);
    expect(dashboard.validatedKpis).toBe(1);
    expect(dashboard.kpiPerformance[0].status).toBe("not_comparable");
    expect(dashboard.overdueActions).toBeGreaterThan(0);
    expect(dashboard.objectivePerformance).toHaveLength(3);
    expect(parseDashboardNumber("R$ 1.234,56")).toBe(1234.56);
    expect(parseDashboardNumber("não informada")).toBeNull();
    await expect(getPlanData(userId, organizationB, cycle.id)).rejects.toThrow("Acesso negado");
  });

  it("reconcilia e aplica os catálogos literais do inventário sem duplicar", async () => {
    expect(OBJECTIVE_TEMPLATES).toHaveLength(13);
    expect(KPI_TEMPLATES).toHaveLength(36);
    expect(BUSINESS_FACT_CATALOG).toHaveLength(31);
    expect(DIAGNOSIS_SIGNAL_CATALOG).toHaveLength(18);
    const cycle = await createCycle({ userId, organizationId: organizationA, companyId: companyA, name: "Ciclo Catálogos", startYear: 2035, endYear: 2037 });
    await saveBusinessFacts({
      userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: 0,
      facts: {
        annual_revenue_current: { value: "0", unavailable: false, confidence: "exact", sourceNote: "Fechamento", referenceDate: "2034-12-31" },
        annual_revenue_previous: { value: "", unavailable: true, confidence: "unavailable" },
      },
    });
    await saveDiagnosisSignals({
      userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: 1,
      signals: { gen_w_margin: { selected: true, intensity: "high", justification: "Diagnóstico validado" } },
    });
    await applyObjectiveTemplate({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: 2, objectiveCode: "gen_fin_margin" });
    await applyObjectiveTemplate({ userId, organizationId: organizationA, cycleId: cycle.id, expectedRevision: 3, objectiveCode: "gen_fin_margin" });
    const plan = await getPlanData(userId, organizationA, cycle.id);
    expect(plan.facts).toHaveLength(2);
    expect(plan.facts.find((item) => item.code === "annual_revenue_current")?.value).toBe(0);
    expect(plan.signals).toHaveLength(18);
    expect(plan.signals.find((item) => item.code === "gen_w_margin")?.selected).toBe(true);
    expect(plan.objectives.filter((item) => item.templateCode === "gen_fin_margin")).toHaveLength(1);
    expect(plan.kpis.filter((item) => item.objectiveId === plan.objectives[0].id)).toHaveLength(KPI_TEMPLATES.filter((item) => item.objectiveCode === "gen_fin_margin").length);
  });

  it("nega login quando o usuário é desativado", async () => {
    await db.update(userProfiles).set({ active: false }).where(eq(userProfiles.userId, userId));
    const response = await login();
    expect(response.status).toBe(403);
    await db.update(userProfiles).set({ active: true }).where(eq(userProfiles.userId, userId));
    const [completeCycle] = await db.select().from(strategicCycles).where(eq(strategicCycles.name, "Ciclo Completo"));
    expect(completeCycle.officialVersionId).toBeTruthy();
  });
});

describe("Entrega 4", () => {
  it("aceita convite uma vez, entra e recupera a senha com token de uso único", async () => {
    const invitedEmail = "gestor.convidado@gmos.local";
    const prepared = await prepareInvitation({ actorUserId: userId, organizationId: organizationA, email: invitedEmail, role: "manager", justification: "Gestão fictícia autorizada", expiresAt: new Date(Date.now() + 60_000) });
    const invited = await acceptInvitation({ token: prepared.token, name: "Gestor Convidado", password: "Senha-inicial-segura-123!" });
    await expect(acceptInvitation({ token: prepared.token, name: "Reuso", password: "Outra-senha-segura-123!" })).rejects.toThrow("já utilizado");
    const signIn = await auth.api.signInEmail({ body: { email: invitedEmail, password: "Senha-inicial-segura-123!" } });
    expect(signIn.user.id).toBe(invited.id);
    await auth.api.requestPasswordReset({ body: { email: invitedEmail, redirectTo: "/redefinir-senha" } });
    const resetRows = await db.select().from(verifications);
    const reset = resetRows.find((item) => item.identifier.startsWith("reset-password:") && item.value === invited.id);
    expect(reset).toBeTruthy();
    const resetToken = reset!.identifier.replace("reset-password:", "");
    await auth.api.resetPassword({ body: { token: resetToken, newPassword: "Senha-recuperada-segura-456!" } });
    await expect(auth.api.resetPassword({ body: { token: resetToken, newPassword: "Senha-reuso-invalida-789!" } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: invitedEmail, password: "Senha-inicial-segura-123!" } })).rejects.toThrow();
    expect((await auth.api.signInEmail({ body: { email: invitedEmail, password: "Senha-recuperada-segura-456!" } })).user.id).toBe(invited.id);
    const sessionResponse = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: invitedEmail, password: "Senha-recuperada-segura-456!" }) }));
    const sessionCookie = sessionResponse.headers.get("set-cookie")!;
    await db.update(sessions).set({ expiresAt: new Date(0) }).where(eq(sessions.userId, invited.id));
    expect(await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie }) })).toBeNull();

    const expired = await prepareInvitation({ actorUserId: userId, organizationId: organizationA, email: "convite.vencido@gmos.local", role: "viewer", justification: "Teste fictício de expiração", expiresAt: new Date(Date.now() + 60_000) });
    await db.update(invitations).set({ expiresAt: new Date(0) }).where(eq(invitations.id, expired.invitation.id));
    await expect(acceptInvitation({ token: expired.token, name: "Convite Vencido", password: "Senha-invalida-segura-123!" })).rejects.toThrow("vencido");
  });

  it("revoga vínculo, bloqueia operações seguintes e aplica a matriz de papéis", async () => {
    const [invitedUser] = await db.select().from(users).where(eq(users.email, "gestor.convidado@gmos.local"));
    await expect(revokeMembership({ actorUserId: userId, organizationId: organizationA, targetUserId: userId, reason: "Tentativa de autorrevogação" })).rejects.toThrow("próprio acesso");
    await expect(revokeMembership({ actorUserId: userId, organizationId: organizationA, targetUserId: invitedUser.id, reason: "curto" })).rejects.toThrow("10 caracteres");
    await revokeMembership({ actorUserId: userId, organizationId: organizationA, targetUserId: invitedUser.id, reason: "Encerramento do acesso fictício" });
    const [cycle] = await db.select().from(strategicCycles).where(eq(strategicCycles.name, "Ciclo Completo"));
    await expect(getPlanData(invitedUser.id, organizationA, cycle.id)).rejects.toThrow("Acesso negado");

    expect(roleHasCapability("group_admin", "iam.manage")).toBe(true);
    expect(roleHasCapability("manager", "planning.write")).toBe(true);
    expect(roleHasCapability("consultant", "planning.review")).toBe(true);
    expect(roleHasCapability("collaborator", "kpi.measure")).toBe(true);
    expect(roleHasCapability("collaborator", "planning.write")).toBe(false);
    expect(roleHasCapability("viewer", "report.read")).toBe(true);
    expect(roleHasCapability("viewer", "kpi.measure")).toBe(false);

    const bootstrapAuth = createAuth({ allowSignUp: true });
    const collaborator = await bootstrapAuth.api.signUpEmail({ body: { email: "colaborador.permissao@gmos.local", name: "Colaborador", password } });
    const viewer = await bootstrapAuth.api.signUpEmail({ body: { email: "visualizador.permissao@gmos.local", name: "Visualizador", password } });
    await db.insert(userProfiles).values([{ userId: collaborator.user.id }, { userId: viewer.user.id }]);
    await db.insert(memberships).values([
      { userId: collaborator.user.id, organizationId: organizationA, role: "collaborator", assignedBy: userId, assignmentJustification: "Teste de permissão colaborador" },
      { userId: viewer.user.id, organizationId: organizationA, role: "viewer", assignedBy: userId, assignmentJustification: "Teste de permissão visualizador" },
    ]);
    const plan = await getPlanData(userId, organizationA, cycle.id);
    const measurement = await recordKpiMeasurement({ userId: collaborator.user.id, organizationId: organizationA, cycleId: cycle.id, kpiId: plan.kpis[0].id, periodStart: "2033-02-01", periodEnd: "2033-02-28", actualValue: "10" });
    expect(measurement.createdBy).toBe(collaborator.user.id);
    await expect(recordKpiMeasurement({ userId: viewer.user.id, organizationId: organizationA, cycleId: cycle.id, kpiId: plan.kpis[0].id, periodStart: "2033-03-01", periodEnd: "2033-03-31", actualValue: "10" })).rejects.toThrow("Sem permissão");
  });

  it("exporta somente o escopo autorizado e restaura backup em banco novo", async () => {
    const [cycle] = await db.select().from(strategicCycles).where(eq(strategicCycles.name, "Ciclo Completo"));
    const exported = await buildAuthorizedExport(userId, organizationA, cycle.id);
    expect(exported.organizationId).toBe(organizationA);
    expect(exported.plan.cycle.organizationId).toBe(organizationA);
    expect(JSON.stringify(exported)).not.toContain(organizationB);
    await expect(buildAuthorizedExport(userId, organizationB, cycle.id)).rejects.toThrow("Acesso negado");

    const archive = await client.dumpDataDir("gzip");
    const restored = await PGlite.create({ loadDataDir: archive });
    const organizationCount = await restored.query<{ count: string }>("select count(*)::text as count from organization");
    const membershipCount = await restored.query<{ count: string }>("select count(*)::text as count from membership");
    expect(organizationCount.rows[0].count).toBe(String((await db.select().from(organizations)).length));
    expect(Number(membershipCount.rows[0].count)).toBeGreaterThan(0);
    await restored.close();
  }, 90_000);
});

describe("Entrega 5B", () => {
  it("gera sugestões isoladas, registra origem e exige decisão humana autorizada", async () => {
    const previousProvider = process.env.GMOS_AI_PROVIDER;
    process.env.GMOS_AI_PROVIDER = "local_preview";
    try {
      const [cycle] = await db.select().from(strategicCycles).where(eq(strategicCycles.name, "Ciclo Completo"));
      const runId = await requestAiAssistance({ userId, organizationId: organizationA, cycleId: cycle.id, mode: "plan_review", note: "Priorizar governança" });
      const workspace = await getAiWorkspace(userId, organizationA, cycle.id);
      const run = workspace.runs.find((item) => item.id === runId);
      expect(run?.status).toBe("completed");
      expect(run?.provider).toBe("local_preview");
      expect(run?.contextHash).toHaveLength(64);
      const suggestion = workspace.suggestions.find((item) => item.runId === runId);
      expect(suggestion?.status).toBe("pending");
      const decided = await decideAiSuggestion({ userId, organizationId: organizationA, cycleId: cycle.id, suggestionId: suggestion!.id, decision: "accepted", note: "Levar para a próxima revisão" });
      expect(decided.status).toBe("accepted");

      const plan = await getPlanData(userId, organizationA, cycle.id);
      const officialVersionId = cycle.officialVersionId;
      await db.update(strategicCycles).set({ workflowStatus: "approved" }).where(eq(strategicCycles.id, cycle.id));
      await expect(applyAiSuggestion({
        userId, organizationId: organizationA, cycleId: cycle.id, suggestionId: suggestion!.id,
        applicationKind: "action", title: "Ação revisada pelo gestor", description: "Descrição humana validada",
        objectiveId: plan.objectives[0].id, ownerName: "Gestor responsável", dueDate: "2033-09-30", priority: "high",
      })).rejects.toThrow("abertura de uma nova revisão");
      const beforeApplication = (await db.select().from(strategicCycles).where(eq(strategicCycles.id, cycle.id)))[0];
      const applied = await applyAiSuggestion({
        userId, organizationId: organizationA, cycleId: cycle.id, suggestionId: suggestion!.id, openRevision: true,
        applicationKind: "action", title: "Ação revisada pelo gestor", description: "Descrição humana validada",
        objectiveId: plan.objectives[0].id, ownerName: "Gestor responsável", dueDate: "2033-09-30", priority: "high",
      });
      expect(applied.application.applicationKind).toBe("action");
      expect(applied.application.openedRevision).toBe(true);
      const [updatedCycle] = await db.select().from(strategicCycles).where(eq(strategicCycles.id, cycle.id));
      expect(updatedCycle.workflowStatus).toBe("under_revision");
      expect(updatedCycle.revision).toBe(beforeApplication.revision + 1);
      expect(updatedCycle.officialVersionId).toBe(officialVersionId);
      const [createdAction] = await db.select().from(actionItems).where(eq(actionItems.id, applied.entity.id));
      expect(createdAction.origin).toBe("ai_suggestion");
      expect(createdAction.title).toBe("Ação revisada pelo gestor");
      expect((await db.select().from(aiSuggestionApplications).where(eq(aiSuggestionApplications.suggestionId, suggestion!.id)))).toHaveLength(1);
      await expect(applyAiSuggestion({
        userId, organizationId: organizationA, cycleId: cycle.id, suggestionId: suggestion!.id, applicationKind: "objective", title: "Duplicado",
      })).rejects.toThrow("já foi aplicada");

      const [viewer] = await db.select().from(users).where(eq(users.email, "visualizador.permissao@gmos.local"));
      await expect(requestAiAssistance({ userId: viewer.id, organizationId: organizationA, cycleId: cycle.id, mode: "action_plan" })).rejects.toThrow("Sem permissão");
      await expect(decideAiSuggestion({ userId, organizationId: organizationB, cycleId: cycle.id, suggestionId: suggestion!.id, decision: "rejected" })).rejects.toThrow("Acesso negado");
    } finally {
      if (previousProvider === undefined) delete process.env.GMOS_AI_PROVIDER;
      else process.env.GMOS_AI_PROVIDER = previousProvider;
    }
  });
});
