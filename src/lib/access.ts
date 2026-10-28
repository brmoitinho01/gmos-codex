import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, invitations, memberships, organizations, userProfiles, users } from "@/db/schema";
import { createAuth } from "./auth";
import { GmosRole, requireCapability } from "./authorization";
import { writeLocalMail } from "./local-mail";

const ROLES: GmosRole[] = ["group_admin", "organization_admin", "manager", "consultant", "collaborator", "viewer"];
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function validateJustification(value: string, label: string) {
  if (value.trim().length < 10) throw new Error(`${label} deve ter pelo menos 10 caracteres.`);
  return value.trim();
}

async function requireIam(actorUserId: string, organizationId: string, targetRole?: GmosRole) {
  const actor = await requireCapability(actorUserId, organizationId, "iam.manage", "Sem permissão para administrar acessos.");
  if (actor.role === "organization_admin" && targetRole && ["group_admin", "organization_admin"].includes(targetRole)) throw new Error("Administrador de organização não pode conceder papel administrativo igual ou superior.");
  return actor;
}

export async function prepareInvitation(input: { actorUserId: string; organizationId: string; email: string; role: GmosRole; justification: string; expiresAt: Date; validUntil?: Date }) {
  await requireIam(input.actorUserId, input.organizationId, input.role);
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.");
  if (!ROLES.includes(input.role)) throw new Error("Papel inválido.");
  const justification = validateJustification(input.justification, "A justificativa");
  if (input.expiresAt <= new Date()) throw new Error("A validade do convite deve estar no futuro.");
  if (input.validUntil && input.validUntil <= new Date()) throw new Error("A vigência do acesso deve estar no futuro.");
  const [[actor], [existingUser], [organization]] = await Promise.all([
    db.select({ email: users.email }).from(users).where(eq(users.id, input.actorUserId)).limit(1),
    db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, input.organizationId)).limit(1),
  ]);
  if (actor?.email.toLowerCase() === email) throw new Error("Não é permitido convidar a própria identidade.");
  if (existingUser) throw new Error("Já existe uma identidade com este e-mail; use uma atribuição autenticada em vez de novo convite.");
  if (!organization) throw new Error("Organização não encontrada.");
  if (process.env.NODE_ENV === "production" && process.env.GMOS_MAIL_MODE !== "local") throw new Error("Provedor de convite real não configurado; o convite permaneceu não criado.");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const invitation = await db.transaction(async (tx) => {
    await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.organizationId, input.organizationId), eq(invitations.email, email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    const [created] = await tx.insert(invitations).values({ organizationId: input.organizationId, email, role: input.role, tokenHash, justification, expiresAt: input.expiresAt, validUntil: input.validUntil ?? null, invitedBy: input.actorUserId }).returning();
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, organizationId: input.organizationId, action: "access.invitation_prepared", entityType: "invitation", entityId: created.id, metadata: { email, role: input.role, expiresAt: input.expiresAt.toISOString() } });
    return created;
  });
  const baseUrl = process.env.GMOS_PUBLIC_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const acceptUrl = new URL(`/convite?token=${encodeURIComponent(token)}`, baseUrl).toString();
  try {
    await writeLocalMail(email, `Convite de acesso GMOS — ${organization.name}`, `Defina sua senha usando este link de uso único: ${acceptUrl}`);
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, invitation.id));
      await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, organizationId: input.organizationId, action: "access.invitation_delivery_failed", entityType: "invitation", entityId: invitation.id });
    });
    throw error;
  }
  return { invitation, token, acceptUrl };
}

export async function acceptInvitation(input: { token: string; name: string; password: string }) {
  const tokenHash = hashToken(input.token);
  const now = new Date();
  const [invitation] = await db.select().from(invitations).where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now))).limit(1);
  if (!invitation) throw new Error("Convite inválido, vencido, revogado ou já utilizado.");
  if (input.name.trim().length < 2) throw new Error("Informe o nome completo.");
  if (input.password.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.");

  const registered = await createAuth({ allowSignUp: true }).api.signUpEmail({ body: { email: invitation.email, name: input.name.trim(), password: input.password } });
  try {
    await db.transaction(async (tx) => {
      const [consumed] = await tx.update(invitations).set({ acceptedBy: registered.user.id, acceptedAt: now }).where(and(eq(invitations.id, invitation.id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now))).returning({ id: invitations.id });
      if (!consumed) throw new Error("O convite foi utilizado ou expirou durante a aceitação.");
      await tx.insert(userProfiles).values({ userId: registered.user.id });
      await tx.insert(memberships).values({ userId: registered.user.id, organizationId: invitation.organizationId, role: invitation.role, active: true, validUntil: invitation.validUntil, assignedBy: invitation.invitedBy, assignmentJustification: invitation.justification });
      await tx.insert(auditLogs).values({ actorUserId: registered.user.id, organizationId: invitation.organizationId, action: "access.invitation_accepted", entityType: "invitation", entityId: invitation.id, metadata: { role: invitation.role } });
    });
  } catch (error) {
    await db.delete(users).where(eq(users.id, registered.user.id));
    throw error;
  }
  return registered.user;
}

export async function revokeMembership(input: { actorUserId: string; organizationId: string; targetUserId: string; reason: string }) {
  await requireIam(input.actorUserId, input.organizationId);
  if (input.actorUserId === input.targetUserId) throw new Error("Não é permitido revogar o próprio acesso.");
  const reason = validateJustification(input.reason, "O motivo da revogação");
  const [target] = await db.select().from(memberships).where(and(eq(memberships.userId, input.targetUserId), eq(memberships.organizationId, input.organizationId), eq(memberships.active, true))).limit(1);
  if (!target) throw new Error("Vínculo ativo não encontrado.");
  await requireIam(input.actorUserId, input.organizationId, target.role);
  if (target.role === "group_admin") {
    const [owners] = await db.select({ value: count() }).from(memberships).where(and(eq(memberships.organizationId, input.organizationId), eq(memberships.role, "group_admin"), eq(memberships.active, true)));
    if (owners.value <= 1) throw new Error("Não é possível revogar o último administrador do Grupo neste escopo.");
  }
  const [revoked] = await db.update(memberships).set({ active: false, revokedAt: new Date(), revokedBy: input.actorUserId, revocationReason: reason }).where(and(eq(memberships.userId, input.targetUserId), eq(memberships.organizationId, input.organizationId), eq(memberships.active, true))).returning();
  if (!revoked) throw new Error("O vínculo já foi alterado.");
  await db.insert(auditLogs).values({ actorUserId: input.actorUserId, organizationId: input.organizationId, action: "access.membership_revoked", entityType: "membership", entityId: `${input.targetUserId}:${input.organizationId}`, metadata: { reason, role: target.role } });
  return revoked;
}

export async function getAccessWorkspace(userId: string, organizationId: string) {
  await requireIam(userId, organizationId);
  const [members, pendingInvitations] = await Promise.all([
    db.select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, active: memberships.active, validUntil: memberships.validUntil, assignedAt: memberships.createdAt }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.organizationId, organizationId)).orderBy(users.name),
    db.select().from(invitations).where(eq(invitations.organizationId, organizationId)).orderBy(invitations.createdAt),
  ]);
  return { members, invitations: pendingInvitations };
}
