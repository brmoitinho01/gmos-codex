import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { memberships, userProfiles } from "@/db/schema";

export type GmosRole = typeof memberships.$inferSelect.role;
export type Capability = "planning.write" | "planning.review" | "planning.approve" | "kpi.measure" | "kpi.validate" | "initiative.manage" | "routine.manage" | "routine.execute" | "structure.manage" | "iam.manage" | "report.read" | "ai.request" | "ai.decide";

const CAPABILITIES: Record<GmosRole, Capability[]> = {
  group_admin: ["planning.write", "planning.approve", "kpi.measure", "kpi.validate", "initiative.manage", "routine.manage", "routine.execute", "structure.manage", "iam.manage", "report.read", "ai.request", "ai.decide"],
  organization_admin: ["planning.write", "planning.approve", "kpi.measure", "kpi.validate", "initiative.manage", "routine.manage", "routine.execute", "structure.manage", "iam.manage", "report.read", "ai.request", "ai.decide"],
  manager: ["planning.write", "planning.approve", "kpi.measure", "kpi.validate", "initiative.manage", "routine.manage", "routine.execute", "structure.manage", "report.read", "ai.request", "ai.decide"],
  consultant: ["planning.review", "report.read", "ai.request"],
  collaborator: ["kpi.measure", "routine.execute", "report.read"],
  viewer: ["report.read"],
};

export async function requireActiveMembership(userId: string, organizationId: string) {
  const now = new Date();
  const [record] = await db
    .select({ role: memberships.role, active: userProfiles.active })
    .from(memberships)
    .innerJoin(userProfiles, eq(userProfiles.userId, memberships.userId))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.active, true),
      eq(userProfiles.active, true),
      or(isNull(memberships.validUntil), gt(memberships.validUntil, now)),
    ))
    .limit(1);
  if (!record) throw new Error("Acesso negado.");
  return record;
}

export async function requirePlanningWrite(userId: string, organizationId: string) {
  return requireCapability(userId, organizationId, "planning.write", "Sem permissão para editar o planejamento.");
}

export async function requireCapability(userId: string, organizationId: string, capability: Capability, message = "Sem permissão para esta operação.") {
  const membership = await requireActiveMembership(userId, organizationId);
  if (!CAPABILITIES[membership.role].includes(capability)) throw new Error(message);
  return membership;
}

export function roleHasCapability(role: GmosRole, capability: Capability) {
  return CAPABILITIES[role].includes(capability);
}

export async function requireTechnicalReview(userId: string, organizationId: string) {
  return requireCapability(userId, organizationId, "planning.review", "A revisão técnica exige papel de consultor.");
}

export async function requireFormalApproval(userId: string, organizationId: string) {
  return requireCapability(userId, organizationId, "planning.approve", "Sem permissão para aprovar o planejamento.");
}
