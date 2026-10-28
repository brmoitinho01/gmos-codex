import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const databaseName = process.env.GMOS_DB_NAME ?? "development";
if (!/^[a-z0-9_-]+$/i.test(databaseName)) throw new Error("GMOS_DB_NAME inválido.");
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const dataDir = isProductionBuild ? "memory://" : path.join(process.cwd(), ".data", databaseName);
if (!isProductionBuild) mkdirSync(path.dirname(dataDir), { recursive: true });

const globalDatabase = globalThis as unknown as {
  gmosPglite?: PGlite;
};

export const client = globalDatabase.gmosPglite ?? new PGlite(dataDir);
globalDatabase.gmosPglite = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
