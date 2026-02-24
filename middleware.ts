
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  if (request.nextUrl.pathname.startsWith('/webcontainer/connect/')) {
    response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
    response.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none')
  }

  return response
}

export const config = {
  matcher: ['/webcontainer/connect/:path*'],
}