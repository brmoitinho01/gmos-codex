import { and, eq, gt, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { businessPortraits, companies, memberships, organizations, strategicCycles } from "@/db/schema";
import { createCycleAction, savePortraitAction } from "./actions";
import { LogoutButton } from "./logout-button";
import { roleHasCapability } from "@/lib/authorization";

export default async function Home({ searchParams }: { searchParams: Promise<{ organizacao?: string; salvo?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const available = await db.select({ id: organizations.id, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, session.user.id), eq(memberships.active, true), or(isNull(memberships.validUntil), gt(memberships.validUntil, new Date()))))
    .orderBy(organizations.name);
  const selectedId = available.some((item) => item.id === params.organizacao) ? params.organizacao! : available[0]?.id;
  if (!selectedId) return <main className="empty-state"><h1>Sem organizações atribuídas</h1><p>Solicite acesso a um administrador.</p><LogoutButton /></main>;

  const [organization] = available.filter((item) => item.id === selectedId);
  const canPlan = roleHasCapability(organization.role, "planning.write");
  const [company] = await db.select().from(companies).where(and(eq(companies.organizationId, selectedId), eq(companies.isRoot, true))).limit(1);
  const cycles = await db.select().from(strategicCycles).where(eq(strategicCycles.organizationId, selectedId)).orderBy(strategicCycles.createdAt);
  const cycle = cycles.at(-1);
  const [portrait] = cycle ? await db.select().from(businessPortraits).where(and(eq(businessPortraits.cycleId, cycle.id), eq(businessPortraits.organizationId, selectedId))).limit(1) : [];

  return (
    <div className="app-shell">
      <aside>
        <div><span className="eyebrow">GRUPO MOITINHO</span><h1>GMOS</h1></div>
        <nav aria-label="Principal">
          <a className="active" href="#visao">Visão Geral</a>
          <Link href={cycle ? `/planejamento?organizacao=${selectedId}&ciclo=${cycle.id}` : "#planejamento"}>Planejamento Estratégico</Link>
          <Link href={cycle ? `/operacao?organizacao=${selectedId}&ciclo=${cycle.id}&modulo=iniciativas` : "#planejamento"}>Plano de Ação</Link>
          {["group_admin","organization_admin"].includes(organization.role) && <Link href={`/acessos?organizacao=${selectedId}`}>Acessos</Link>}
        </nav>
        <LogoutButton />
      </aside>
      <main>
        <header className="topbar">
          <div><span className="eyebrow">ORGANIZAÇÃO ATIVA</span><h2>{organization.name}</h2></div>
          <form method="get">
            <label htmlFor="organization">Trocar organização</label>
            <select id="organization" name="organizacao" defaultValue={selectedId}>
              {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="submit">Abrir</button>
          </form>
        </header>

        <section id="visao" className="hero">
          <div><span className="status">ENTREGA 4 · LIBERAÇÃO INTERNA</span><h2>Planejamento que volta para a execução.</h2><p>Seis fases, operação integrada e acessos individuais auditados.</p></div>
          <div className="metric"><strong>{cycles.length}</strong><span>ciclos estratégicos</span></div>
        </section>

        <section id="planejamento">
          <div className="section-heading"><div><span className="eyebrow">FASE 1 DE 6</span><h2>Retrato do negócio</h2></div><span className="role">{organization.role.replaceAll("_", " ")}</span></div>
          {!cycle && canPlan ? (
            <form action={createCycleAction} className="card form-grid">
              <input type="hidden" name="organizationId" value={selectedId} />
              <input type="hidden" name="companyId" value={company.id} />
              <div className="full"><h3>Criar primeiro ciclo</h3><p>Os dados deste ciclo não se misturam com outros períodos.</p></div>
              <label>Nome do ciclo<input name="name" placeholder="Planejamento 2027–2029" required /></label>
              <label>Ano inicial<input name="startYear" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} required /></label>
              <label>Ano final<input name="endYear" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear() + 2} required /></label>
              <button type="submit">Criar ciclo</button>
            </form>
          ) : cycle && canPlan ? (
            <form action={savePortraitAction} className="card portrait-form">
              <input type="hidden" name="organizationId" value={selectedId} />
              <input type="hidden" name="cycleId" value={cycle.id} />
              <input type="hidden" name="expectedRevision" value={cycle.revision} />
              <div className="cycle-bar"><div><strong>{cycle.name}</strong><span>{cycle.startYear}–{cycle.endYear}</span></div><span className="status neutral">{cycle.status}</span></div>
              {params.salvo && <p className="success" role="status">Retrato salvo. O conteúdo permanecerá disponível no próximo acesso.</p>}
              <label>O que este negócio entrega?<textarea name="businessDescription" rows={4} defaultValue={portrait?.businessDescription} /></label>
              <label>Quem é o cliente principal?<textarea name="primaryCustomer" rows={3} defaultValue={portrait?.primaryCustomer} /></label>
              <label>Qual valor é percebido pelo cliente?<textarea name="valueProposition" rows={3} defaultValue={portrait?.valueProposition} /></label>
              <label>Qual é o principal desafio hoje?<textarea name="mainChallenge" rows={3} defaultValue={portrait?.mainChallenge} /></label>
              <div className="form-footer"><span>Salvamento auditado por usuário e organização.</span><button type="submit">Salvar retrato</button></div>
            </form>
          ) : <article className="card portrait-form"><h3>Consulta autorizada</h3><p>Seu papel permite leitura, mas não alteração do planejamento.</p></article>}
        </section>
        {cycle && <section className="module-launcher"><div className="section-heading"><div><span className="eyebrow">ENTREGA 3</span><h2>Módulos operacionais</h2></div></div><div className="entity-list">{[["painel","Painel da empresa"],["indicadores","Medições de KPI"],["iniciativas","Iniciativas"],["rotinas","Rotinas"],["trabalho","Meu trabalho"],["estrutura","Estrutura e organograma"]].map(([module,label]) => <Link className="card module-card" key={module} href={`/operacao?organizacao=${selectedId}&ciclo=${cycle.id}&modulo=${module}`}><span className="eyebrow">ABRIR MÓDULO</span><strong>{label}</strong></Link>)}</div></section>}
      </main>
    </div>
  );
}
