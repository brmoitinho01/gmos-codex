import { and, eq, gt, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";
import { getAccessWorkspace } from "@/lib/access";
import { getServerSession } from "@/lib/server-session";
import { LogoutButton } from "../logout-button";
import { prepareInvitationAction, revokeMembershipAction } from "../access-actions";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ organizacao?: string; preparado?: string; revogado?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const manageable = await db.select({ id: organizations.id, name: organizations.name, role: memberships.role }).from(memberships).innerJoin(organizations, eq(organizations.id, memberships.organizationId)).where(and(eq(memberships.userId, session.user.id), eq(memberships.active, true), or(isNull(memberships.validUntil), gt(memberships.validUntil, new Date())))).orderBy(organizations.name);
  const organization = manageable.find((item) => item.id === params.organizacao && ["group_admin","organization_admin"].includes(item.role)) ?? manageable.find((item) => ["group_admin","organization_admin"].includes(item.role));
  if (!organization) return <main className="empty-state"><h1>Sem permissão para administrar acessos</h1><Link href="/">Voltar</Link></main>;
  const data = await getAccessWorkspace(session.user.id, organization.id);

  return <div className="app-shell"><aside><div><span className="eyebrow">GRUPO MOITINHO</span><h1>GMOS</h1></div><nav aria-label="Principal"><Link href={`/?organizacao=${organization.id}`}>Visão Geral</Link><Link className="active" href={`/acessos?organizacao=${organization.id}`}>Acessos</Link></nav><LogoutButton /></aside><main>
    <header className="topbar"><div><span className="eyebrow">LIBERAÇÃO INTERNA</span><h2>Acessos · {organization.name}</h2></div><form method="get"><label>Organização<select name="organizacao" defaultValue={organization.id}>{manageable.filter((item) => ["group_admin","organization_admin"].includes(item.role)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button>Abrir</button></form></header>
    {(params.preparado || params.revogado) && <p className="success">Operação concluída e registrada na auditoria.</p>}
    <section><div className="section-heading"><div><span className="eyebrow">CONVITES LOCAIS</span><h2>Preparar novo acesso</h2></div></div><p className="notice">O convite é de uso único. Neste ambiente ele é gravado na caixa postal local; nenhum e-mail real é enviado.</p><form action={prepareInvitationAction} className="card form-grid compact"><input type="hidden" name="organizationId" value={organization.id} /><label>E-mail<input name="email" type="email" required /></label><label>Papel<select name="role"><option value="manager">Gestor</option><option value="consultant">Consultor</option><option value="collaborator">Colaborador</option><option value="viewer">Visualizador</option>{organization.role === "group_admin" && <><option value="organization_admin">Administrador da organização</option><option value="group_admin">Administrador do Grupo</option></>}</select></label><label>Expira em<input name="expiresAt" type="datetime-local" required /></label><label>Vigência do acesso até<input name="validUntil" type="date" /></label><label className="full">Justificativa — mínimo 10 caracteres<textarea name="justification" minLength={10} required /></label><button>Preparar convite</button></form></section>
    <section className="catalog-section"><div className="section-heading"><div><span className="eyebrow">VÍNCULOS</span><h2>Pessoas autorizadas</h2></div></div><div className="table-wrap"><table><thead><tr><th>Pessoa</th><th>Papel</th><th>Situação</th><th>Vigência</th><th>Revogar</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.userId}><td><strong>{member.name}</strong><br/><small>{member.email}</small></td><td>{member.role}</td><td>{member.active ? "ativo" : "revogado"}</td><td>{member.validUntil?.toISOString().slice(0,10) ?? "sem término"}</td><td>{member.active && member.userId !== session.user.id ? <form action={revokeMembershipAction} className="inline-form"><input type="hidden" name="organizationId" value={organization.id}/><input type="hidden" name="targetUserId" value={member.userId}/><input name="reason" minLength={10} placeholder="Motivo da revogação" required/><button className="danger">Revogar</button></form> : "—"}</td></tr>)}</tbody></table></div></section>
    <section className="catalog-section"><div className="section-heading"><div><span className="eyebrow">RASTREABILIDADE</span><h2>Convites preparados</h2></div></div><div className="table-wrap"><table><thead><tr><th>E-mail</th><th>Papel</th><th>Expiração</th><th>Estado</th></tr></thead><tbody>{data.invitations.map((invite) => <tr key={invite.id}><td>{invite.email}</td><td>{invite.role}</td><td>{invite.expiresAt.toISOString()}</td><td>{invite.acceptedAt ? "aceito" : invite.revokedAt ? "revogado" : invite.expiresAt < new Date() ? "vencido" : "pendente"}</td></tr>)}</tbody></table></div></section>
  </main></div>;
}
