import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 🔒 Korumalı sayfalar listesi
const protectedRoutes = ['/matrix', '/audit', '/dashboard']

// ✅ Next.js 16 için yeni format: proxy fonksiyonu
export function proxy(req: NextRequest) {
  const token =
    req.cookies.get('access_token')?.value ||
    req.headers.get('Authorization')?.replace('Bearer ', '') ||
    null

  const { pathname } = req.nextUrl

  // Eğer kullanıcı korumalı sayfaya erişmeye çalışıyorsa
  if (protectedRoutes.some((r) => pathname.startsWith(r))) {
    if (!token) {
      const loginUrl = new URL('/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

// 🌍 Hangi path’lerde çalışacağını belirtiyoruz
export const config = {
  matcher: ['/matrix/:path*', '/audit/:path*', '/dashboard/:path*'],
}
