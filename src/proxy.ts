/**
 * Clerk middleware — enforces authentication boundary.
 * All /dashboard/* and /onboarding routes require an active Clerk session.
 * Public routes: /, /sign-in, /sign-up, /pricing
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/qualify(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pricing',
  '/api/stripe/webhook', // Stripe sends unauthenticated POST — must be public
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
};
