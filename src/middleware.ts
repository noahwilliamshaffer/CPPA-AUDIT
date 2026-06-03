/**
 * Offline mode — no authentication. All routes are public.
 * Using the Next.js 16 proxy convention.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
