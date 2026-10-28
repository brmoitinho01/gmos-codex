import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizedExport } from "@/lib/export";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const organizationId = request.nextUrl.searchParams.get("organizacao");
  const cycleId = request.nextUrl.searchParams.get("ciclo");
  if (!organizationId || !cycleId) return NextResponse.json({ error: "Informe organização e ciclo." }, { status: 400 });
  try {
    const exported = await buildAuthorizedExport(session.user.id, organizationId, cycleId);
    return NextResponse.json(exported, { headers: { "cache-control": "private, no-store", "content-disposition": `attachment; filename="gmos-${cycleId}.json"` } });
  } catch {
    return NextResponse.json({ error: "Acesso negado ou recurso inexistente." }, { status: 403 });
  }
}
