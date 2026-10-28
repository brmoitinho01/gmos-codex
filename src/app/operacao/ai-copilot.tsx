import type { getAiWorkspace } from "@/lib/ai-assistance";
import { roleHasCapability, type GmosRole } from "@/lib/authorization";
import { applyAiSuggestionAction, decideAiSuggestionAction, requestAiAssistanceAction } from "../ai-actions";

type Workspace = Awaited<ReturnType<typeof getAiWorkspace>>;

const modeLabels = { plan_review: "Revisar coerência do plano", objectives_kpis: "Analisar objetivos e KPIs", action_plan: "Analisar plano de ação" };
const statusLabels: Record<string, string> = { pending: "Aguardando decisão", accepted: "Aceita para revisão", rejected: "Rejeitada", applied: "Aplicada ao rascunho" };

export function AiCopilot({ workspace, organizationId, cycleId, role, objectives, cycleWorkflowStatus }: {
  workspace: Workspace;
  organizationId: string;
  cycleId: string;
  role: GmosRole;
  objectives: Array<{ id: string; title: string }>;
  cycleWorkflowStatus: string;
}) {
  const canRequest = roleHasCapability(role, "ai.request");
  const canDecide = roleHasCapability(role, "ai.decide");
  const canApply = canDecide && roleHasCapability(role, "planning.write");
  const common = <><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="cycleId" value={cycleId} /></>;
  const suggestionsByRun = new Map(workspace.runs.map((run) => [run.id, workspace.suggestions.filter((item) => item.runId === run.id)]));

  return <section>
    <div className="section-heading"><div><span className="eyebrow">ENTREGA 5B</span><h2>Copiloto estratégico</h2></div><span className={`ai-provider ${workspace.configuration.ready ? "ready" : "disabled"}`}>{workspace.configuration.label}</span></div>
    <p className="notice">O copiloto produz sugestões para análise humana. Aceitar uma sugestão não altera o plano oficial nem cria dados automaticamente.</p>

    <div className="two-columns ai-intro">
      <article className="card ai-policy"><span className="eyebrow">CONTROLE HUMANO</span><h3>Como funciona</h3><ul><li>usa somente o ciclo e a organização selecionados;</li><li>não envia pessoas, e-mails ou credenciais;</li><li>não inventa números, custos ou responsáveis;</li><li>registra provedor, modelo, contexto e decisão;</li><li>mantém sugestões separadas da versão oficial.</li></ul></article>
      <form action={requestAiAssistanceAction} className="card stack-form ai-request">
        {common}
        <span className="eyebrow">NOVA ANÁLISE</span>
        <label>Tipo de apoio<select name="mode" defaultValue="plan_review">{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Orientação adicional<textarea name="note" maxLength={1000} placeholder="Ex.: priorize riscos de execução e qualidade dos indicadores." /></label>
        <button disabled={!canRequest || !workspace.configuration.ready}>Gerar sugestões</button>
        {!workspace.configuration.ready && <small>Configure um provedor no servidor para habilitar. A operação manual do GMOS continua disponível.</small>}
        {workspace.configuration.provider === "local_preview" && <small>Esta opção valida o fluxo e não representa uma resposta de modelo de IA.</small>}
      </form>
    </div>

    <section className="catalog-section"><div className="section-heading"><div><span className="eyebrow">HISTÓRICO AUDITÁVEL</span><h2>Análises e sugestões</h2></div></div>
      <div className="ai-run-list">{workspace.runs.map((run) => <article className="card ai-run" key={run.id}>
        <header><div><span className="eyebrow">{modeLabels[run.mode as keyof typeof modeLabels] || run.mode}</span><h3>{run.provider} · {run.model}</h3></div><span className={`status neutral`}>{run.status}</span></header>
        <small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(run.startedAt)} · prompt {run.promptVersion}</small>
        {run.errorMessage && <p className="error">{run.errorMessage}</p>}
        <div className="ai-suggestions">{(suggestionsByRun.get(run.id) ?? []).map((suggestion) => {
          const payload = suggestion.payload as { risks?: string[]; nextSteps?: string[] };
          return <article className="ai-suggestion" key={suggestion.id}>
            <div className="ai-suggestion-title"><span className="eyebrow">{suggestion.category}</span><span className={`suggestion-status ${suggestion.status}`}>{statusLabels[suggestion.status] || suggestion.status}</span></div>
            <h4>{suggestion.title}</h4><p>{suggestion.recommendation}</p><p className="rationale"><strong>Por quê:</strong> {suggestion.rationale}</p>
            {payload.risks?.length ? <details><summary>Riscos</summary><ul>{payload.risks.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
            {payload.nextSteps?.length ? <details><summary>Próximos passos</summary><ul>{payload.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
            {suggestion.status === "pending" && canDecide && <form action={decideAiSuggestionAction} className="decision-form">{common}<input type="hidden" name="suggestionId" value={suggestion.id} /><label>Nota da decisão<input name="note" maxLength={1000} /></label><div><button name="decision" value="accepted">Aceitar para revisão</button><button className="danger" name="decision" value="rejected">Rejeitar</button></div></form>}
            {suggestion.status === "accepted" && canApply && <form action={applyAiSuggestionAction} className="application-form">
              {common}<input type="hidden" name="suggestionId" value={suggestion.id} />
              <div className="application-heading"><div><span className="eyebrow">CONVERSÃO CONTROLADA</span><strong>Revise os campos antes de criar</strong></div><small>Nenhum texto da sugestão é aplicado sem esta confirmação.</small></div>
              <label>Converter em<select name="applicationKind" defaultValue={suggestion.category === "kpi" || suggestion.category === "action" || suggestion.category === "objective" ? suggestion.category : "objective"}><option value="objective">Objetivo</option><option value="kpi">KPI</option><option value="action">Ação</option></select></label>
              <label>Objetivo relacionado<select name="objectiveId"><option value="">Selecione para KPI ou ação</option>{objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}</select></label>
              <label className="full">Título revisado<input name="title" defaultValue={suggestion.title} maxLength={200} required /></label>
              <label className="full">Descrição revisada<textarea name="description" defaultValue={suggestion.recommendation} maxLength={3000} /></label>
              <label>Responsável<input name="ownerName" maxLength={160} /></label><label>Prazo<input type="date" name="dueDate" /></label>
              <label>Prioridade<select name="priority" defaultValue="medium"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
              <details className="full kpi-fields"><summary>Campos necessários se a conversão for em KPI</summary><div className="application-grid"><label>Unidade<input name="unit" maxLength={40} /></label><label>Fonte<input name="source" maxLength={160} /></label><label>Periodicidade<input name="periodicity" maxLength={40} placeholder="Ex.: mensal" /></label><label>Direção<select name="direction" defaultValue="higher"><option value="higher">Quanto maior, melhor</option><option value="lower">Quanto menor, melhor</option><option value="target">Faixa/meta exata</option></select></label><label className="full">Fórmula<input name="formula" /></label><label>Baseline<input name="baseline" maxLength={60} /></label><label>Meta<input name="target" maxLength={60} /></label></div></details>
              {cycleWorkflowStatus === "approved" && <label className="check revision-confirm full"><input type="checkbox" name="openRevision" /> Confirmo a abertura de uma nova revisão. A versão oficial aprovada permanecerá preservada.</label>}
              {cycleWorkflowStatus === "in_review" || cycleWorkflowStatus === "awaiting_approval" ? <p className="notice full">A aplicação ficará disponível quando o ciclo sair da revisão.</p> : <button className="full" type="submit">{cycleWorkflowStatus === "approved" ? "Abrir revisão e aplicar" : "Aplicar ao rascunho"}</button>}
            </form>}
            {suggestion.decisionNote && <small>Nota da decisão: {suggestion.decisionNote}</small>}
          </article>;
        })}</div>
      </article>)}</div>
      {!workspace.runs.length && <div className="card empty-ai"><h3>Nenhuma análise solicitada</h3><p>Quando o provedor estiver habilitado, as sugestões aparecerão aqui com sua trilha de decisão.</p></div>}
    </section>
  </section>;
}
