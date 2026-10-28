import { KPI_TEMPLATES, OBJECTIVE_TEMPLATES } from "@/lib/inventory-catalog.generated";
import { applyObjectiveTemplateAction } from "../actions";

export function TemplateCatalog({ organizationId, cycleId, revision }: { organizationId: string; cycleId: string; revision: number }) {
  return <section className="catalog-section">
    <div className="section-heading">
      <div><span className="eyebrow">BIBLIOTECA DO DOSSIÊ</span><h2>Objetivos e indicadores prontos para configurar</h2></div>
      <span className="role">13 objetivos · 36 KPIs</span>
    </div>
    <p className="notice">Aplicar um modelo cria o objetivo e seus indicadores sem inventar linha de base, meta ou responsável. Complete esses campos antes da aprovação.</p>
    <div className="template-grid">
      {OBJECTIVE_TEMPLATES.map((template) => {
        const kpis = KPI_TEMPLATES.filter((item) => item.objectiveCode === template.code);
        return <article className="card" key={template.code}>
          <span className="eyebrow">{template.dimension.replaceAll("_", " ")} · {kpis.length} KPIs</span>
          <h3>{template.title}</h3>
          <p>{template.description}</p>
          <small>{template.rationale}</small>
          <details><summary>Ver indicadores</summary><ul>{kpis.map((kpi) => <li key={kpi.code}>{kpi.name}</li>)}</ul></details>
          <form action={applyObjectiveTemplateAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="cycleId" value={cycleId} />
            <input type="hidden" name="expectedRevision" value={revision} />
            <input type="hidden" name="objectiveCode" value={template.code} />
            <button type="submit">Aplicar objetivo e KPIs</button>
          </form>
        </article>;
      })}
    </div>
  </section>;
}
