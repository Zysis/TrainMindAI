import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedPaths = ['/dashboard'];

// Routes that should redirect to dashboard if already authenticated
const authPaths = ['/login', '/register'];

export function middleware(_request: NextRequest) {
  // Placeholder. Full auth checks currently happen client-side via AuthProvider.
  // The matcher below scopes this to /dashboard, /login, /register so we can
  // enhance with cookie-based tokens in a future sprint.
  // See `protectedPaths` and `authPaths` above for the intended scope.
  void protectedPaths;
  void authPaths;
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
