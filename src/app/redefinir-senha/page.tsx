import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="login-shell">
    <div className="brand-block"><span className="eyebrow">GMOS · ACESSO</span><h1>Nova senha</h1><p>Use uma senha exclusiva com pelo menos 12 caracteres.</p></div>
    <ResetForm token={token} />
  </main>;
}
