import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const source = process.env.GMOS_RESTORE_SOURCE;
const targetName = process.env.GMOS_DB_NAME;
if (!source) throw new Error("Defina GMOS_RESTORE_SOURCE para o arquivo de backup.");
if (!targetName?.startsWith("restore-")) throw new Error("Por segurança, GMOS_DB_NAME de restauração deve começar com restore-.");
const destination = path.resolve(".data", targetName);
const bytes = await readFile(path.resolve(source));
const restored = new PGlite(destination, { loadDataDir: new Blob([bytes]) });
await restored.waitReady;
const [organizations, memberships, cycles] = await Promise.all([
  restored.query<{ count: string }>("select count(*)::text as count from organization"),
  restored.query<{ count: string }>("select count(*)::text as count from membership"),
  restored.query<{ count: string }>("select count(*)::text as count from strategic_cycle"),
]);
console.log(JSON.stringify({ destination, organizations: organizations.rows[0].count, memberships: memberships.rows[0].count, cycles: cycles.rows[0].count }));
await restored.close();
