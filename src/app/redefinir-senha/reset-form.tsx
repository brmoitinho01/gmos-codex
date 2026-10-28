"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ResetForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await authClient.resetPassword({ token, newPassword: String(form.get("password")) });
    setMessage(result.error ? "O link é inválido ou expirou." : "Senha atualizada. Você já pode entrar.");
  }
  return <form onSubmit={submit} className="card login-form">
    <h2>Definir nova senha</h2>
    <label htmlFor="password">Nova senha<input id="password" name="password" type="password" minLength={12} required /></label>
    <button type="submit">Atualizar senha</button>
    {message && <p className={message.startsWith("Senha") ? "success" : "error"} role="status">{message}</p>}
    <a href="/login">Voltar ao login</a>
  </form>;
}
