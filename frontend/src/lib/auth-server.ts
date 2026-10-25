import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./auth";

export function serverToken(): string | null {
  return cookies().get(TOKEN_COOKIE)?.value ?? null;
}