import type { ExecutiveDashboardData, InventoryWorkspace, PerformanceStatus } from "@/lib/inventory";

const statusLabel: Record<PerformanceStatus, string> = {
  on_target: "Na meta",
  attention: "Atenção",
  off_target: "Fora da meta",
  no_measurement: "Sem medição validada",
  not_comparable: "Não comparável",
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ProgressBar({ value, label }: { value: number | null; label: string }) {
  return <div className="progress-block">
    <div><span>{label}</span><strong>{value === null ? "—" : `${value}%`}</strong></div>
    <div className="progress-track" aria-label={`${label}: ${value === null ? "sem dados" : `${value}%`}`}>
      <span style={{ width: `${value ?? 0}%` }} />
    </div>
  </div>;
}

function CostBlock({ label, summary }: { label: string; summary: ExecutiveDashboardData["actionCosts"] }) {
  return <article className="card cost-card">
    <span className="eyebrow">{label}</span>
    <dl>
      <div><dt>Planejado</dt><dd>{summary.planned === null ? "—" : money.format(summary.planned)}</dd></div>
      <div><dt>Executado</dt><dd>{summary.actual === null ? "—" : money.format(summary.actual)}</dd></div>
      <div><dt>Variação</dt><dd className={summary.variance !== null && summary.variance > 0 ? "negative" : ""}>{summary.variance === null ? "—" : money.format(summary.variance)}</dd></div>
    </dl>
    <small>Cobertura: {summary.actualCoverage}/{summary.total} com custo realizado.</small>
  </article>;
}

export function ExecutiveDashboard({
  data,
  dashboard,
  organizationId,
  cycleId,
  selectedObjective,
}: {
  data: InventoryWorkspace;
  dashboard: ExecutiveDashboardData;
  organizationId: string;
  cycleId: string;
  selectedObjective?: string;
}) {
  const objective = selectedObjective && data.objectives.some((item) => item.id === selectedObjective) ? selectedObjective : "";
  const visibleKpis = objective ? dashboard.kpiPerformance.filter((item) => item.objectiveId === objective) : dashboard.kpiPerformance;
  const visibleObjectives = objective ? dashboard.objectivePerformance.filter((item) => item.objectiveId === objective) : dashboard.objectivePerformance;
  const objectiveNames = new Map(data.objectives.map((item) => [item.id, item.title]));

  return <section>
    <div className="section-heading dashboard-heading">
      <div><span className="eyebrow">PAINEL DA EMPRESA</span><h2>Planejado × executado</h2></div>
      <form method="get" className="dashboard-filter">
        <input type="hidden" name="organizacao" value={organizationId} />
        <input type="hidden" name="ciclo" value={cycleId} />
        <input type="hidden" name="modulo" value="painel" />
        <label>Objetivo
          <select name="objetivo" defaultValue={objective}>
            <option value="">Todos os objetivos</option>
            {data.objectives.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>
    </div>

    <div className="dashboard-grid executive-metrics">
      <article className="card metric-card"><strong>{dashboard.onTargetPercent === null ? "—" : `${dashboard.onTargetPercent}%`}</strong><span>KPIs comparáveis na meta</span><small>{dashboard.onTargetCount} na meta · {dashboard.attentionCount} em atenção · {dashboard.offTargetCount} fora</small></article>
      <article className="card metric-card"><strong>{dashboard.actionProgress === null ? "—" : `${dashboard.actionProgress}%`}</strong><span>avanço médio das ações</span><small>{dashboard.overdueActions} atrasada(s)</small></article>
      <article className="card metric-card"><strong>{dashboard.initiativeProgress === null ? "—" : `${dashboard.initiativeProgress}%`}</strong><span>avanço médio das iniciativas</span><small>{dashboard.openInitiatives} aberta(s)</small></article>
      <article className="card metric-card"><strong>{dashboard.routineCompletionPercent === null ? "—" : `${dashboard.routineCompletionPercent}%`}</strong><span>rotinas encerradas concluídas</span><small>{dashboard.pendingRoutines} pendente(s)</small></article>
      <article className="card metric-card"><strong>{dashboard.validatedKpis}/{data.kpis.length}</strong><span>KPIs com medição validada</span><small>{dashboard.pendingValidations} medição(ões) pendente(s)</small></article>
      <article className="card metric-card"><strong>{dashboard.activeObjectives}</strong><span>objetivos acompanhados</span><small>{dashboard.overdueInitiatives} iniciativa(s) vencida(s)</small></article>
    </div>

    <p className="notice">O desempenho oficial usa somente medições validadas e valores numéricos compatíveis. Ausência de informação não é convertida em zero.</p>

    <div className="dashboard-columns">
      <section className="card dashboard-panel">
        <div className="section-heading"><div><span className="eyebrow">LEITURA EXECUTIVA</span><h3>Pontos de atenção</h3></div></div>
        {dashboard.alerts.length ? <div className="alert-list">{dashboard.alerts.map((alert) => <article className={`executive-alert ${alert.tone}`} key={alert.title}><strong>{alert.title}</strong><span>{alert.detail}</span></article>)}</div> : <p className="empty-inline">Nenhum alerta calculável com os dados atuais.</p>}
      </section>
      <section className="cost-grid">
        <CostBlock label="AÇÕES" summary={dashboard.actionCosts} />
        <CostBlock label="INICIATIVAS" summary={dashboard.initiativeCosts} />
      </section>
    </div>

    <section className="catalog-section">
      <div className="section-heading"><div><span className="eyebrow">MAPA DE OBJETIVOS</span><h2>Desempenho por objetivo</h2></div></div>
      <div className="objective-scorecards">{visibleObjectives.map((item) => <article className="card objective-scorecard" key={item.objectiveId}>
        <span className="eyebrow">{item.status}</span>
        <h3>{item.title}</h3>
        <small>{item.ownerName || "Responsável não informado"}</small>
        <ProgressBar value={item.comparableCount ? Math.round(item.onTargetCount / item.comparableCount * 100) : null} label="KPIs na meta" />
        <ProgressBar value={item.actionProgress} label="Ações executadas" />
        <ProgressBar value={item.initiativeProgress} label="Iniciativas executadas" />
        <footer>{item.kpiCount} KPI(s) · {item.overdueActions} ação(ões) atrasada(s)</footer>
      </article>)}</div>
    </section>

    <section className="catalog-section">
      <div className="section-heading"><div><span className="eyebrow">INDICADORES</span><h2>Meta × realizado validado</h2></div></div>
      <div className="table-wrap"><table className="performance-table"><thead><tr><th>Objetivo / KPI</th><th>Período</th><th>Planejado</th><th>Executado</th><th>Atingimento</th><th>Situação</th></tr></thead><tbody>
        {visibleKpis.map((item) => <tr key={item.kpiId}>
          <td><strong>{item.name}</strong><small>{objectiveNames.get(item.objectiveId)} · {item.ownerName || "sem responsável"}</small></td>
          <td>{item.periodEnd || "—"}</td>
          <td>{item.targetLabel ?? "—"} {item.targetLabel ? item.unit : ""}</td>
          <td>{item.actualLabel ?? "—"} {item.actualLabel ? item.unit : ""}</td>
          <td><div className="mini-progress"><span style={{ width: `${item.attainmentPercent ?? 0}%` }} /></div><small>{item.attainmentPercent === null ? "não calculável" : `${item.attainmentPercent}%`}</small></td>
          <td><span className={`performance-status ${item.status}`}>{statusLabel[item.status]}</span>{item.latestValidationStatus === "pending" && <small>Há medição mais recente pendente.</small>}</td>
        </tr>)}
        {!visibleKpis.length && <tr><td colSpan={6}>Nenhum KPI no filtro selecionado.</td></tr>}
      </tbody></table></div>
    </section>
  </section>;
}
