import "server-only";

import { cookies } from "next/headers";
import { auth } from "./auth";

export async function getServerSession() {
  const cookieHeader = (await cookies()).getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  if (!cookieHeader) return null;
  return auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
}
