const mode = process.env.GMOS_RELEASE_MODE || "local";
const failures: string[] = [];
const warnings: string[] = [];
const secret = process.env.BETTER_AUTH_SECRET || "";
const publicUrl = process.env.GMOS_PUBLIC_URL || process.env.BETTER_AUTH_URL || "";
const databaseName = process.env.GMOS_DB_NAME || "development";
const aiProvider = process.env.GMOS_AI_PROVIDER || "disabled";

if (secret.length < 32) failures.push("BETTER_AUTH_SECRET ausente ou menor que 32 caracteres.");
try {
  const url = new URL(publicUrl);
  if (mode !== "local" && url.protocol !== "https:") failures.push("Ambiente conectado exige URL pública HTTPS.");
} catch { failures.push("GMOS_PUBLIC_URL/BETTER_AUTH_URL inválida."); }
if (mode !== "local" && ["development", "test"].includes(databaseName)) failures.push("Use um GMOS_DB_NAME exclusivo fora do ambiente local.");
if (mode !== "local" && !process.env.GMOS_MAIL_PROVIDER) failures.push("Provedor real de e-mail não configurado.");
if (!["disabled", "local_preview", "openai"].includes(aiProvider)) failures.push("GMOS_AI_PROVIDER desconhecido.");
if (mode !== "local" && aiProvider === "local_preview") failures.push("Simulação local do copiloto não pode ser usada em ambiente conectado.");
if (aiProvider === "openai" && (!process.env.OPENAI_API_KEY || !process.env.GMOS_AI_MODEL)) failures.push("Copiloto OpenAI exige OPENAI_API_KEY e GMOS_AI_MODEL no servidor.");
if (mode === "local") warnings.push("Modo local: convites e recuperação usam caixa postal em .data/mailbox.");
if (aiProvider === "disabled") warnings.push("Copiloto estratégico desativado.");

console.log(JSON.stringify({ mode, databaseName, publicUrl, aiProvider, failures, warnings }, null, 2));
if (failures.length) process.exitCode = 1;
