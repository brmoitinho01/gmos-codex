"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    if (result.error) {
      setError("E-mail ou senha inválidos.");
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card login-form">
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Senha</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      <a href="/recuperar-senha">Esqueci minha senha</a>
    </form>
  );
}
