import { migrate } from "drizzle-orm/pglite/migrator";
import { db, client } from "./index";

export async function migrateDatabase() {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrateDatabase();
  await client.close();
  console.log("Migrations aplicadas com sucesso.");
}
