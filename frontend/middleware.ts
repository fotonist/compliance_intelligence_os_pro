import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 🔴 AUTH ARTIK BACKEND + FETCH HEADER ÜZERİNDEN
// 🔴 MIDDLEWARE SADECE PASS-THROUGH

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
