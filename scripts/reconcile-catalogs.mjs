import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(resolve(root, "referencias/dossie/anexos/QUESTIONARIOS_CATALOGOS_SQL.md"), "utf8");
const method = readFileSync(resolve(root, "referencias/dossie/03_METODOLOGIA_E_QUESTIONARIOS.md"), "utf8");

function block(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Bloco ausente: ${start}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`Fim ausente: ${end}`);
  return source.slice(from, to);
}

function tuples(source) {
  return source.match(/\((?:[^'()]|'(?:''|[^'])*')*\)/gs) ?? [];
}

function fields(tuple) {
  const body = tuple.slice(1, -1);
  const out = [];
  let token = "", quote = false, bracket = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "'" && body[index + 1] === "'" && quote) { token += "''"; index += 1; continue; }
    if (char === "'") quote = !quote;
    if (!quote && char === "[") bracket += 1;
    if (!quote && char === "]") bracket -= 1;
    if (!quote && bracket === 0 && char === ",") { out.push(token.trim()); token = ""; continue; }
    token += char;
  }
  out.push(token.trim());
  return out.map(value);
}

function value(raw) {
  if (raw === "NULL") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("ARRAY[")) return [...raw.matchAll(/'((?:''|[^'])*)'/g)].map((item) => item[1].replaceAll("''", "'"));
  const match = raw.match(/^'((?:''|[^'])*)'/s);
  if (match) return match[1].replaceAll("''", "'");
  return raw;
}

const objectiveBlock = block(sql, "INSERT INTO public.strategy_template_objectives", "ON CONFLICT (version, code)");
const objectiveRows = tuples(objectiveBlock.slice(objectiveBlock.indexOf("VALUES") + 6)).map(fields);
const objectives = objectiveRows.map((row) => ({ version: row[0], code: row[1], sector: row[2], dimension: row[3], stages: row[4], title: row[5], description: row[6], rationale: row[7], baseWeight: row[8], sortOrder: row[9] }));

const kpiRows = tuples(block(sql, "FROM (VALUES", ") AS v(objective_code")).map(fields).filter((row) => row.length === 11);
const kpis = kpiRows.map((row) => ({ objectiveCode: row[0], code: row[1], name: row[2], kpiClass: row[3], description: row[4], unit: row[5], formula: row[6], sourceHint: row[7], direction: row[8], frequency: row[9], sortOrder: row[10] }));

const factBlock = block(sql, "INSERT INTO public.strategy_fact_definitions", "ON CONFLICT (version, code");
const factRows = tuples(factBlock.slice(factBlock.indexOf("VALUES") + 6)).map(fields);
const facts = factRows.map((row) => ({ version: row[0], code: row[1], label: row[2], description: row[3], dimension: row[4], category: row[5], valueType: row[6], unit: row[7], universal: row[8], sector: row[9], importance: row[10], allowNegative: row[11], sortOrder: row[12] }));

const signalBlock = block(method, "INSERT INTO public.strategy_diagnosis_statements", "ON CONFLICT (version, code)");
const signalRows = tuples(signalBlock.slice(signalBlock.indexOf("VALUES") + 6)).map(fields);
const signals = signalRows.map((row) => ({ version: row[0], code: row[1], sector: row[2], dimension: row[3], quadrant: row[4], statement: row[5], weight: row[6], sortOrder: row[7] }));

if (objectives.length !== 13 || kpis.length !== 36 || facts.length !== 31 || signals.length !== 18) {
  throw new Error(`Contagem divergente: ${objectives.length} objetivos, ${kpis.length} KPIs, ${facts.length} fatos, ${signals.length} sinais.`);
}

const banner = "// Gerado por scripts/reconcile-catalogs.mjs a partir do dossiê preservado. Não editar manualmente.\n";
const output = `${banner}export const OBJECTIVE_TEMPLATES = ${JSON.stringify(objectives, null, 2)} as const;\n\nexport const KPI_TEMPLATES = ${JSON.stringify(kpis, null, 2)} as const;\n\nexport const BUSINESS_FACT_CATALOG = ${JSON.stringify(facts, null, 2)} as const;\n\nexport const DIAGNOSIS_SIGNAL_CATALOG = ${JSON.stringify(signals, null, 2)} as const;\n`;
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/inventory-catalog.generated.ts"), output);
console.log(`Catálogos reconciliados: ${objectives.length} objetivos, ${kpis.length} KPIs, ${facts.length} fatos e ${signals.length} sinais.`);
