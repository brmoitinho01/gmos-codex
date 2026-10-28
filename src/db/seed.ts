import { db, client } from "./index";
import { companies, organizations } from "./schema";

export const INITIAL_ORGANIZATIONS = [
  { slug: "rm-mineracao", name: "RM Mineração" },
  { slug: "restaurante-meu-querido", name: "Restaurante Meu Querido" },
  { slug: "xrm-pre-moldados", name: "XRM Pré-moldados" },
  { slug: "xrm-construtora", name: "XRM Construtora" },
  { slug: "blue-house", name: "Blue House" },
  { slug: "toca-hub", name: "Toca Hub" },
] as const;

export async function seedOrganizations() {
  for (const item of INITIAL_ORGANIZATIONS) {
    const [organization] = await db
      .insert(organizations)
      .values(item)
      .onConflictDoUpdate({ target: organizations.slug, set: { name: item.name, updatedAt: new Date() } })
      .returning();

    await db
      .insert(companies)
      .values({ organizationId: organization.id, name: item.name, isRoot: true })
      .onConflictDoNothing();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedOrganizations();
  await client.close();
  console.log("Seis organizações e empresas-raiz conferidas.");
}
