import { redirect } from "next/navigation";
import { calculatePlanCompletion, getPlanData } from "@/lib/planning";
import { getServerSession } from "@/lib/server-session";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ organizacao?: string; ciclo?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  if (!params.organizacao || !params.ciclo) redirect("/");
  const plan = await getPlanData(session.user.id, params.organizacao, params.ciclo);
  const completion = calculatePlanCompletion(plan);
  const direction = plan.sections.find((item) => item.phase === "direction")?.data as Record<string, string> | undefined;
  const swot = plan.sections.find((item) => item.phase === "swot")?.data as Record<string, string> | undefined;
  const official = plan.versions.find((item) => item.id === plan.cycle.officialVersionId);
  return <main className="report">
    <header><span className="eyebrow">GMOS · RELATÓRIO ESTRATÉGICO</span><h1>{plan.cycle.name}</h1><p>{plan.cycle.startYear}–{plan.cycle.endYear} · {official ? `versão oficial ${official.versionNumber}` : "rascunho sem aprovação"} · {completion.percent}% concluído</p></header>
    <section><h2>Retrato do negócio</h2><p>{plan.portrait?.businessDescription || "Não informado"}</p><dl><dt>Cliente principal</dt><dd>{plan.portrait?.primaryCustomer || "Não informado"}</dd><dt>Proposta de valor</dt><dd>{plan.portrait?.valueProposition || "Não informado"}</dd><dt>Desafio</dt><dd>{plan.portrait?.mainChallenge || "Não informado"}</dd></dl></section>
    <section><h2>Direcionamento</h2><dl><dt>Missão</dt><dd>{direction?.mission || "Não informada"}</dd><dt>Visão</dt><dd>{direction?.vision || "Não informada"}</dd><dt>Valores</dt><dd>{direction?.values || "Não informados"}</dd><dt>Norte</dt><dd>{direction?.north || "Não informado"}</dd></dl></section>
    <section><h2>SWOT</h2><div className="report-grid">{[["Forças",swot?.strengths],["Fraquezas",swot?.weaknesses],["Oportunidades",swot?.opportunities],["Ameaças",swot?.threats]].map(([label,value]) => <div key={label}><h3>{label}</h3><p>{value || "Não informado"}</p></div>)}</div></section>
    <section><h2>Objetivos, indicadores e ações</h2>{plan.objectives.map((objective) => <article key={objective.id}><h3>{objective.title}</h3><p>{objective.description}</p><h4>Indicadores</h4><ul>{plan.kpis.filter((item) => item.objectiveId === objective.id).map((item) => <li key={item.id}>{item.name}: {item.formula} · meta {item.target || "não informada"}</li>)}</ul><h4>Ações</h4><ul>{plan.actions.filter((item) => item.objectiveId === objective.id).map((item) => <li key={item.id}>{item.title} · {item.ownerName || "sem responsável"} · {item.dueDate || "sem prazo"}</li>)}</ul></article>)}</section>
    <footer>Gerado pelo GMOS. Dados limitados à organização e ao ciclo autorizados.</footer>
  </main>;
}
