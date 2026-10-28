import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { client } from "../src/db/index";

const requested = process.env.GMOS_BACKUP_PATH;
const output = path.resolve(requested || path.join("backups", `gmos-${process.env.GMOS_DB_NAME || "development"}-${new Date().toISOString().replaceAll(":", "-")}.tgz`));
await mkdir(path.dirname(output), { recursive: true });
await client.waitReady;
const archive = await client.dumpDataDir("gzip");
await writeFile(output, new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 });
await client.close();
console.log(`Backup consistente criado em ${output}`);
