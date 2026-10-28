"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptInvitation, prepareInvitation, revokeMembership } from "@/lib/access";
import { GmosRole } from "@/lib/authorization";
import { getServerSession } from "@/lib/server-session";

async function currentUserId() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export async function prepareInvitationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId"));
  await prepareInvitation({
    actorUserId: await currentUserId(), organizationId,
    email: String(formData.get("email")), role: String(formData.get("role")) as GmosRole,
    justification: String(formData.get("justification")), expiresAt: new Date(String(formData.get("expiresAt"))),
    validUntil: formData.get("validUntil") ? new Date(String(formData.get("validUntil"))) : undefined,
  });
  revalidatePath("/acessos");
  redirect(`/acessos?organizacao=${organizationId}&preparado=1`);
}

export async function revokeMembershipAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId"));
  await revokeMembership({ actorUserId: await currentUserId(), organizationId, targetUserId: String(formData.get("targetUserId")), reason: String(formData.get("reason")) });
  revalidatePath("/acessos");
  redirect(`/acessos?organizacao=${organizationId}&revogado=1`);
}

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token"));
  if (String(formData.get("password")) !== String(formData.get("passwordConfirmation"))) redirect(`/convite?token=${encodeURIComponent(token)}&erro=senhas`);
  try {
    await acceptInvitation({ token, name: String(formData.get("name")), password: String(formData.get("password")) });
  } catch {
    redirect(`/convite?token=${encodeURIComponent(token)}&erro=invalido`);
  }
  redirect("/login?convite=aceito");
}
