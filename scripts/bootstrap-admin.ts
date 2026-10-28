import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { migrateDatabase } from "../src/db/migrate";
import { seedOrganizations } from "../src/db/seed";
import { db, client } from "../src/db";
import { auditLogs, memberships, organizations, userProfiles, users } from "../src/db/schema";
import { createAuth } from "../src/lib/auth";

async function readPassword() {
  const fromEnvironment = process.env.GMOS_ADMIN_PASSWORD;
  if (fromEnvironment) return fromEnvironment;
  if (!stdin.isTTY) throw new Error("Defina GMOS_ADMIN_PASSWORD no processo ou execute em terminal interativo.");
  stdout.write("Senha inicial (mínimo 12 caracteres): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  for await (const chunk of stdin) {
    const key = String(chunk);
    if (key === "\r" || key === "\n") break;
    if (key === "\u0003") process.exit(130);
    if (key === "\u007f") value = value.slice(0, -1);
    else value += key;
  }
  stdin.setRawMode(false);
  stdin.pause();
  stdout.write("\n");
  return value;
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = (process.env.GMOS_ADMIN_EMAIL ?? await terminal.question("E-mail do primeiro administrador: ")).trim().toLowerCase();
  const name = (process.env.GMOS_ADMIN_NAME ?? await terminal.question("Nome do primeiro administrador: ")).trim();
  terminal.close();
  if (!email || !name) throw new Error("Nome e e-mail são obrigatórios.");

  await migrateDatabase();
  await seedOrganizations();

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  let userId = existingUser?.id;
  if (!userId) {
    const password = await readPassword();
    if (password.length < 12) throw new Error("A senha precisa ter no mínimo 12 caracteres.");
    const bootstrapAuth = createAuth({ allowSignUp: true });
    const result = await bootstrapAuth.api.signUpEmail({ body: { email, name, password } });
    userId = result.user.id;
  }

  await db.transaction(async (tx) => {
    await tx.insert(userProfiles).values({ userId }).onConflictDoUpdate({
      target: userProfiles.userId,
      set: { active: true, updatedAt: new Date() },
    });
    const allOrganizations = await tx.select({ id: organizations.id }).from(organizations);
    for (const organization of allOrganizations) {
      await tx.insert(memberships).values({
        userId,
        organizationId: organization.id,
        role: "group_admin",
      }).onConflictDoUpdate({
        target: [memberships.userId, memberships.organizationId],
        set: { role: "group_admin", active: true, validUntil: null },
      });
    }
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "bootstrap.first_admin",
      entityType: "user",
      entityId: userId,
      metadata: { organizationCount: allOrganizations.length },
    });
  });

  console.log("Primeiro administrador preparado e vinculado explicitamente às seis organizações.");
}

try {
  await main();
} finally {
  await client.close();
}
