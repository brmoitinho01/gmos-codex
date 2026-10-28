export const MATURITY_QUESTIONS = [
  ["fin_01", "finance", "A empresa acompanha resultado financeiro mensal com fechamento confiável?", 1.5],
  ["fin_02", "finance", "Existe controle de custos por unidade e por produto/serviço?", 1],
  ["mkt_01", "marketing_sales", "A empresa tem previsibilidade de vendas e funil acompanhado?", 1.5],
  ["mkt_02", "marketing_sales", "A satisfação do cliente é medida de forma sistemática?", 1],
  ["ope_01", "operations", "Os processos críticos estão padronizados e documentados?", 1.5],
  ["ope_02", "operations", "Existem rotinas recorrentes com evidência de execução?", 1],
  ["peo_01", "people", "Papéis, responsabilidades e chefias estão claros?", 1.5],
  ["peo_02", "people", "Existe plano de desenvolvimento e avaliação de desempenho?", 1],
  ["gov_01", "governance", "Existe rotina de reuniões de gestão com decisões registradas?", 1.5],
  ["gov_02", "governance", "O planejamento estratégico é acompanhado por indicadores?", 1.5],
] as const;

export const MATURITY_OPTIONS = [
  [0, "Não existe / não acompanhamos"],
  [1, "Informal"],
  [2, "Parcial"],
  [3, "Regular e acompanhado"],
  [4, "Maduro, analisado e melhorado"],
] as const;

type Group = { key: string; title: string; items: { key: string; label: string }[] };
const group = (key: string, title: string, labels: string[]): Group => ({
  key, title, items: labels.map((label, index) => ({ key: `${key}_${index + 1}`, label })),
});

export const ANALYSIS_TOOLS = [
  { code: "pest", title: "Análise PEST", description: "Avalie oportunidades e ameaças do ambiente.", columns: [["op", "Oportunidade"], ["am", "Ameaça"]], groups: [
    group("politico", "Político", ["Carga tributária e incentivos", "Mudanças de legislação", "Direito do consumidor", "Legislação trabalhista", "Fiscalização", "Infraestrutura pública"]),
    group("economico", "Econômico", ["Crescimento da economia", "Inflação", "Taxa de juros e crédito", "Renda e emprego da população", "Câmbio", "Custo dos insumos"]),
    group("social", "Social", ["Hábitos e estilo de vida", "Crescimento da população local", "Preocupação com saúde e bem-estar", "Segurança pública", "Turismo e eventos"]),
    group("tecnologico", "Tecnológico", ["Vendas e pedidos digitais", "Novos equipamentos e processos", "Redes sociais e marketing digital", "Automação e sistemas de gestão"]),
  ]},
  { code: "porter", title: "5 Forças de Porter", description: "Médias altas indicam maior pressão.", columns: [["n", "Nota"]], groups: [
    group("entrantes", "Entrada de novos concorrentes", ["É possível ser pequeno para entrar no negócio", "Os concorrentes têm marcas pouco conhecidas", "O investimento inicial é baixo", "Os clientes têm baixo custo para trocar de fornecedor", "O mercado não está saturado"]),
    group("rivalidade", "Rivalidade entre concorrentes", ["Há muitos concorrentes de porte parecido", "O mercado cresce pouco", "Os produtos são pouco diferenciados", "Há guerra de preços frequente"]),
    group("substitutos", "Ameaça de produtos substitutos", ["Existem substitutos com preço mais baixo", "Os substitutos têm qualidade parecida", "O cliente troca facilmente pelo substituto"]),
    group("clientes", "Poder dos clientes", ["Poucos clientes concentram as vendas", "Os clientes pesquisam muito preço", "Os clientes conhecem bem o produto"]),
    group("fornecedores", "Poder dos fornecedores", ["Há poucos fornecedores dos principais insumos", "É caro trocar de fornecedor", "Os fornecedores impõem preços e prazos"]),
  ]},
  { code: "atratividade", title: "Atratividade do setor", description: "Avalie o presente e o futuro.", columns: [["pr", "Presente"], ["fu", "Futuro"]], groups: [
    group("mercado", "Fatores de mercado", ["Tamanho do mercado", "Crescimento do mercado", "Diferenciação dos produtos", "Sensibilidade a preços", "Sazonalidade", "Rentabilidade do setor"]),
    group("competitivos", "Fatores competitivos", ["Intensidade da concorrência", "Barreiras de entrada", "Barreiras de saída", "Existência de substitutos"]),
    group("economicos", "Fatores econômicos e governamentais", ["Inflação", "Juros e crédito", "Tributação", "Regulamentação"]),
  ]},
  { code: "ciclo_vida", title: "Ciclo de vida do setor", description: "O estágio de maior média indica a fase atual.", columns: [["n", "Nota"]], groups: [
    group("introducao", "Introdução", ["O produto ou serviço é novidade no mercado", "Ainda não há mercado consolidado", "Exige alto investimento em divulgação", "Ainda não há padrão de qualidade definido"]),
    group("crescimento", "Crescimento", ["O setor está em forte crescimento", "O produto já é reconhecido pelos clientes", "Novas empresas estão entrando no setor", "As vendas crescem mês a mês"]),
    group("maturidade", "Maturidade", ["O mercado está estável", "A concorrência é forte e conhecida", "Os preços estão pressionados", "Crescer exige tirar clientes dos concorrentes"]),
    group("declinio", "Declínio", ["As vendas do setor estão caindo", "Empresas estão saindo do setor", "Os clientes migram para substitutos"]),
  ]},
  { code: "fcs", title: "Fatores-chave de sucesso × concorrentes", description: "Compare a empresa com concorrentes.", columns: [["nos", "Nossa empresa"], ["c1", "Concorrente 1"], ["c2", "Concorrente 2"], ["c3", "Concorrente 3"]], groups: [group("fatores", "Fatores", ["Rapidez", "Qualidade", "Distribuição e entrega", "Preço", "Confiabilidade", "Escala de produção", "Atendimento", "Pós-venda"])]},
  { code: "competencias", title: "Competências da empresa", description: "Avalie valor, sustentabilidade e versatilidade.", columns: [["val", "Valiosa"], ["sus", "Sustentável"], ["ver", "Versátil"]], groups: [group("competencias", "Competências", ["Competência 1", "Competência 2", "Competência 3", "Competência 4", "Competência 5"])]},
  { code: "estrategias", title: "Estratégias genéricas", description: "A maior média descreve a estratégia predominante.", columns: [["n", "Nota"]], groups: [
    group("custo", "Liderança em custo", ["Temos o menor custo entre os concorrentes", "Compramos em escala e com bom preço", "Nossos processos são enxutos e padronizados"]),
    group("diferenciacao", "Diferenciação", ["Nosso produto é percebido como único", "O cliente aceita pagar mais pela nossa marca", "Investimos em inovação e experiência"]),
    group("foco", "Foco", ["Atendemos um público específico", "Conhecemos profundamente nosso nicho", "Concentramos esforços em poucos produtos"]),
  ]},
] as const;

export type AnalysisCode = typeof ANALYSIS_TOOLS[number]["code"];

export function maturityResult(answers: Record<string, number | null>) {
  let weighted = 0;
  let maximum = 0;
  let answered = 0;
  for (const [code, , , weight] of MATURITY_QUESTIONS) {
    const score = answers[code];
    if (score === null || score === undefined) continue;
    if (!Number.isInteger(score) || score < 0 || score > 4) throw new Error("Nota de maturidade inválida.");
    weighted += score * weight;
    maximum += 4 * weight;
    answered += 1;
  }
  const score = maximum ? Math.round((weighted / maximum) * 1000) / 10 : null;
  const band = score === null ? null : score < 40 ? "Inicial" : score < 60 ? "Estruturando" : score < 80 ? "Gerenciado" : "Escalável";
  return { score, band, answered, total: MATURITY_QUESTIONS.length, complete: answered === MATURITY_QUESTIONS.length, provisional: answered < MATURITY_QUESTIONS.length };
}

export function analysisResult(code: AnalysisCode, answers: Record<string, number | null>) {
  const tool = ANALYSIS_TOOLS.find((item) => item.code === code);
  if (!tool) throw new Error("Questionário desconhecido.");
  const valid = Object.values(answers).filter((value): value is number => value !== null && value !== undefined);
  if (valid.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) throw new Error("As notas das análises devem ser inteiras de 1 a 5.");
  const total = tool.groups.reduce((sum, item) => sum + item.items.length * tool.columns.length, 0);
  const average = valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : null;
  return { average, answered: valid.length, total, complete: valid.length === total, coverage: total ? Math.round(valid.length / total * 100) : 0 };
}
