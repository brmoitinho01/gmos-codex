import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, userProfiles, users, verifications } from "@/db/schema";

export function createAuth(options: { allowSignUp?: boolean } = {}) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      minPasswordLength: 12,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Entrega local: não envia dados para serviços externos.
        const { writeLocalMail } = await import("./local-mail");
        await writeLocalMail(user.email, "Recuperação de acesso GMOS", url);
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [profile] = await db.select({ active: userProfiles.active }).from(userProfiles)
              .where(eq(userProfiles.userId, session.userId)).limit(1);
            if (!profile?.active) throw new APIError("FORBIDDEN", { message: "Usuário desativado." });
            return { data: session };
          },
        },
      },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
    telemetry: { enabled: false },
  });
}

export const auth = createAuth();
