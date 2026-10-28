import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) redirect("/");
  return (
    <main className="login-shell">
      <div className="brand-block">
        <span className="eyebrow">GRUPO MOITINHO</span>
        <h1>GMOS</h1>
        <p>Planejamento estratégico e gestão da execução.</p>
      </div>
      <LoginForm />
    </main>
  );
}
