import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth/jwt";

const PUBLIC_PATHS = new Set(["/login", "/registro"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (PUBLIC_PATHS.has(pathname) || pathname === "/") {
    return NextResponse.redirect(new URL("/quiniela", request.url));
  }

  if (pathname.startsWith("/admin") && !session.admin) {
    return NextResponse.redirect(new URL("/quiniela", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
