import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export async function writeLocalMail(to: string, subject: string, body: string) {
  if (process.env.NODE_ENV === "production" && process.env.GMOS_MAIL_MODE !== "local") {
    throw new Error("Provedor de e-mail real não configurado.");
  }
  const directory = path.resolve(process.cwd(), ".data", "mailbox");
  await mkdir(directory, { recursive: true });
  await appendFile(
    path.join(directory, "outbox.jsonl"),
    `${JSON.stringify({ to, subject, body, createdAt: new Date().toISOString() })}\n`,
    { mode: 0o600 },
  );
}
