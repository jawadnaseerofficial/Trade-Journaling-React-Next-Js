export const TOKEN_COOKIE = "tj_token";

export function clientSetToken(token: string): void {
  document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=43200; samesite=lax`;
}

export function clientClearToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function clientGetToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}