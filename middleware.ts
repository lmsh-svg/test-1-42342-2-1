import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/init', '/age-verification', '/access-denied'];
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token in cookie or header
  const authToken = request.cookies.get('auth_token')?.value || 
                   request.headers.get('Authorization')?.replace('Bearer ', '');

  // For client-side navigation (same-origin requests), allow through
  // The client-side auth will handle redirects
  const isClientNavigation = request.headers.get('referer')?.startsWith(request.nextUrl.origin);

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!authToken && !isClientNavigation) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect marketplace routes
  if (pathname.startsWith('/marketplace')) {
    if (!authToken && !isClientNavigation) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect API routes (except auth endpoints)
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/marketplace/:path*',
    '/api/:path*',
  ],
};