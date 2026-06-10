import { NextResponse, type NextRequest } from 'next/server';

// Auth is handled client-side via AdminGuard (Firebase Auth + custom claims check).
// Middleware only excludes Next.js internals and static assets from processing.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
