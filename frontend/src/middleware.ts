import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("tj_token")?.value;
  const isLogin = req.nextUrl.pathname.startsWith("/login");

  // Never bounce the login page. A stale token must be able to REACH the form
  // so it can be cleared. (The login page verifies the token client-side.)
  if (isLogin) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};