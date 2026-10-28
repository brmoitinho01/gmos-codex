# GMOS — reconstrução independente

Reconstrução independente do Grupo Moitinho Operating System. O projeto não importa banco, autenticação, migrations, segredos ou dados do ambiente Lovable.

## Entrega 1 implementada

- login individual por e-mail e senha, logout, sessão e recuperação local;
- cadastro público bloqueado e primeiro administrador criado por comando controlado;
- seis organizações independentes, cada uma com sua empresa-raiz;
- papéis `group_admin`, `organization_admin`, `manager`, `consultant`, `collaborator` e `viewer`;
- vínculo explícito por organização, expiração e bloqueio de usuário desativado;
- criação de ciclo estratégico e edição do Retrato do Negócio;
- isolamento de organização no serviço e relacionamentos protegidos no banco;
- trilha de auditoria para bootstrap, ciclo e retrato;
- migrations versionadas e testes de persistência real.

## Entrega 2 implementada

- jornada operacional com as seis fases: Retrato, Diagnóstico, Direcionamento, SWOT, Objetivos/KPIs e Planos de Ação;
- questionário literal de maturidade (dez perguntas ponderadas) e sete análises estratégicas com notas inteiras de 1 a 5;
- distinção entre resposta ausente e nota zero na maturidade, e entre ausente e notas 1–5 nas análises;
- objetivos, indicadores e ações vinculados ao mesmo ciclo e organização;
- salvamento de rascunho, retomada e progresso calculado por requisitos efetivamente persistidos;
- controle otimista de concorrência pelo número de revisão;
- revisão técnica exclusiva de consultor, aprovação formal por gestor e bloqueio da revisão submetida;
- fotografia completa e imutável a cada aprovação, mantendo a versão oficial anterior enquanto há nova revisão;
- relatório mínimo imprimível, autorizado e isolado por organização;
- teste integrado do percurso completo com identidades e organização fictícias.

## Entrega 3 implementada

- 31 fatos de negócio com tipo, confiança, origem, data de referência e indisponibilidade explícita;
- 18 sinais de diagnóstico guiado, preservando dimensão, quadrante, intensidade e justificativa;
- biblioteca reconciliada com 13 objetivos e 36 KPIs, aplicável sem duplicação e sem inventar baseline, meta ou responsável;
- medições históricas de KPIs com período, realizado, evidência, validação e snapshot da definição/meta aplicadas;
- iniciativas estratégicas com workflow controlado e derivação idempotente para ação;
- ações ampliadas para 5W2H, KPI, custos, resultado, origem, dependências e riscos;
- modelos e execuções de rotina, com frequência, responsável, evidência e impedimento;
- painel operacional, carteira individual e organograma com pessoas, posições e ocupações;
- 28 tabelas no modelo, quatro migrations incrementais e auditoria das operações críticas.

## Entrega 4 implementada

- convites locais de uso único com expiração, papel, vigência e justificativa;
- definição inicial de senha, rejeição de convite vencido/reutilizado e recuperação com token consumível;
- administração de vínculos com proibição de autoatribuição/autorrevogação, hierarquia de concessão e proteção administrativa;
- matriz explícita de capacidades para administrador do Grupo, administrador de organização, gestor, consultor, colaborador e visualizador;
- revogação auditada que bloqueia a operação seguinte no servidor;
- exportação JSON limitada à organização/ciclo autorizados e endpoint de saúde;
- backup consistente e restauração protegida em banco separado;
- gate de liberação para diferenciar teste local de ambiente conectado;
- Dockerfile e Compose preparados, sem publicação ou envio real.

## Entrega 5 implementada parcialmente

- dashboard executivo planejado × executado, com KPIs validados, progresso, custos, alertas e visão por objetivo;
- copiloto estratégico com modos de revisão do plano, objetivos/KPIs e plano de ação;
- sugestões estruturadas separadas do plano oficial, com aceite ou rejeição humana;
- conversão controlada de sugestão aceita em objetivo, KPI ou ação, sempre com edição e confirmação do gestor;
- abertura explícita de nova revisão quando a aplicação altera um plano aprovado, preservando a fotografia oficial anterior;
- vínculo auditável e idempotente entre sugestão, campos revisados e registro criado;
- trilha auditável de provedor, modelo, versão do prompt, hash do contexto e decisão;
- contexto limitado à organização/ciclo e sem pessoas, e-mails ou credenciais;
- integração OpenAI opcional pela Responses API, desativada por padrão e sem chave gravada no banco;
- simulação local explicitamente identificada para validar o fluxo sem transmitir dados.

Para habilitar um modelo OpenAI, configure `GMOS_AI_PROVIDER=openai`, `GMOS_AI_MODEL` e `OPENAI_API_KEY` somente no ambiente do servidor. Sem as três condições, o botão de geração permanece bloqueado. A opção `local_preview` não é IA e serve apenas para testar interface, auditoria e decisão humana.

## Arquitetura deste incremento

Next.js 16, React 19, TypeScript, Better Auth, Drizzle ORM e PGlite. PGlite executa PostgreSQL localmente dentro do processo, persiste em `.data/` e tornou possível comprovar banco real neste ambiente sem Docker ou servidor PostgreSQL instalado. O domínio usa apenas um ORM. Uma implantação futura em PostgreSQL servidor troca o driver, não o modelo de negócio.

## Preparação local

Requisitos: Node.js 24 ou superior e pnpm 11.

```bash
pnpm install
cp .env.example .env.local
```

Preencha `BETTER_AUTH_SECRET` em `.env.local` com uma chave gerada localmente:

```bash
openssl rand -base64 32
```

Depois execute:

```bash
pnpm db:migrate
pnpm db:seed
pnpm bootstrap:admin
pnpm dev
```

O bootstrap solicita nome, e-mail e senha no terminal, oculta a senha e pode ser repetido sem duplicar organizações ou vínculos. Para automação controlada, aceita `GMOS_ADMIN_EMAIL`, `GMOS_ADMIN_NAME` e `GMOS_ADMIN_PASSWORD` apenas no ambiente do processo.

O ambiente de desenvolvimento registra mensagens de recuperação em `.data/mailbox/outbox.jsonl`; nenhum e-mail sai da máquina. Não use esse mecanismo em produção.

Para conferir novamente os catálogos literais contra o dossiê preservado:

```bash
pnpm catalogs:reconcile
```

## Verificação

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm release:check
```

O teste integrado recria somente o banco `.data/test-suite`, aplica as migrations do zero e verifica os fluxos anteriores mais: convite/aceitação, expiração e reuso, recuperação de senha, sessão expirada, revogação, seis papéis, exportação autorizada, restauração de backup e aplicação controlada das sugestões aceitas.

## Backup e restauração

Pare a aplicação antes do backup operacional e execute:

```bash
GMOS_BACKUP_PATH=/caminho/seguro/gmos.tgz pnpm backup
GMOS_DB_NAME=restore-validacao GMOS_RESTORE_SOURCE=/caminho/seguro/gmos.tgz pnpm restore
```

Por segurança, a restauração aceita apenas banco cujo nome comece com `restore-`. O arquivo contém autenticação e dados empresariais; mantenha permissão restrita e não o envie por canais não aprovados.

## Estado de liberação

O projeto está pronto para teste local em uma única instância. `pnpm release:check` passa no modo local. O modo conectado recusa liberação enquanto não houver URL HTTPS real, banco exclusivo e provedor de e-mail configurado. `localhost` não é endereço compartilhável para gestores em outros computadores.

## Limites atuais

- Convites reais e endereço compartilhável não foram executados: faltam e-mails confirmados, provedor autorizado, URL HTTPS e destino de implantação.
- PGlite é adequado ao desenvolvimento local e à prova desta entrega; produção requer PostgreSQL servidor, provedor de e-mail e estratégia de backup aprovados.
- Políticas pendentes D/P/A não foram transformadas em regras operacionais.
- BSC, DRE, importação de planilha e módulos setoriais avançados continuam apenas catalogados porque as fontes não fornecem todos os campos, fluxos e critérios; não foram preenchidos com regras genéricas.
- O JSON externo e o mapa da planilha citados no Prompt V2 não vieram no pacote. Os quatro catálogos necessários a esta entrega foram reconstruídos do SQL e da metodologia preservados, com contagens verificadas.
- PGlite deve rodar como instância local única. Implantação multi-instância requer a troca já prevista para PostgreSQL servidor.
