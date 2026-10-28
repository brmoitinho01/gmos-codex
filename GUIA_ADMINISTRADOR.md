# Guia do administrador — GMOS local

## Preparação

1. Instale Node.js 24 e pnpm 11.
2. Copie `.env.example` para `.env.local` e defina `BETTER_AUTH_SECRET`.
3. Execute `pnpm install`, `pnpm db:migrate` e `pnpm db:seed`.
4. Crie o primeiro administrador com `pnpm bootstrap:admin`.
5. Inicie com `pnpm dev`.

O bootstrap é idempotente. Cadastro público permanece bloqueado. A recuperação usa caixa postal local e não envia e-mail real.

## Atualização para a Entrega 3

Encerre qualquer processo antigo que esteja usando `.data/development` e execute `pnpm db:migrate`. As migrations `0002` e `0003` adicionam fatos, sinais, medições, iniciativas, rotinas, estrutura e campos 5W2H. Não force uma migration enquanto o diretório estiver aberto por outro processo.

## Operação e segurança

- Toda leitura ou escrita exige vínculo ativo com a organização.
- Papéis gestores escrevem; consultor executa revisão técnica; visualizadores não recebem permissão de edição.
- Troque a organização e o ciclo pelos seletores da interface, nunca alterando IDs no banco.
- Use o módulo Estrutura para pessoas, posições e ocupações; isso não cria automaticamente um usuário de login.
- Convites e administração remota de acessos não pertencem a esta entrega.

## Verificação e recuperação

Execute `pnpm catalogs:reconcile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`. O banco de desenvolvimento fica em `.data/`; faça backup consistente somente com a aplicação parada. Para produção, substitua PGlite por PostgreSQL servidor e aprove estratégia de backup, e-mail e recuperação antes da liberação.

### Convites e revogação

Administradores acessam `/acessos`. Toda concessão exige justificativa com pelo menos 10 caracteres; administrador de organização não concede papel administrativo igual ou superior. Autoatribuição e autorrevogação são bloqueadas. No modo local, o link fica em `.data/mailbox/outbox.jsonl`; esse arquivo contém token sensível e deve ter acesso restrito.

Revogar um vínculo não apaga o usuário nem dados históricos. A próxima operação naquele escopo é negada. Cadastros de pessoas no organograma não concedem login automaticamente.

### Backup testado

Com a aplicação parada, defina `GMOS_BACKUP_PATH` e execute `pnpm backup`. Restaure sempre em destino novo usando `GMOS_DB_NAME=restore-...` e `GMOS_RESTORE_SOURCE=... pnpm restore`. Confira as contagens exibidas antes de qualquer troca de destino. A troca de um banco operacional por restauração continua exigindo autorização específica.

### Gate de implantação

Use `GMOS_RELEASE_MODE=connected pnpm release:check`. O gate conectado exige segredo adequado, URL pública HTTPS, nome de banco não local e provedor de e-mail. O Compose é apenas preparação; não foi publicado nem executado neste ambiente.
