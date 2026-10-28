"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function RecoverPasswordPage() {
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/redefinir-senha",
    });
    setSent(true);
  }
  return <main className="login-shell">
    <div className="brand-block"><span className="eyebrow">GMOS · ACESSO</span><h1>Recuperar</h1><p>No ambiente local, a mensagem é registrada em <code>.data/mailbox</code>.</p></div>
    <form onSubmit={submit} className="card login-form">
      <h2>Recuperação de senha</h2>
      {sent ? <p className="success" role="status">Se o e-mail existir, as instruções foram geradas.</p> : <>
        <label htmlFor="email">E-mail<input id="email" name="email" type="email" required /></label>
        <button type="submit">Enviar instruções</button>
      </>}
      <a href="/login">Voltar ao login</a>
    </form>
  </main>;
}
