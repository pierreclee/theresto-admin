import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/mfa-enrollment',
  '/auth/mfa-challenge',
  '/auth/access-denied',
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes through
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow all other routes (auth will be handled client-side by AdminGuard)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
