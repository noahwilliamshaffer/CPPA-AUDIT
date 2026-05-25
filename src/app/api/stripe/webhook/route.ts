/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Verifies the signature and processes
 * checkout.session.completed events to advance assessment status
 * from 'locked' → 'complete'.
 *
 * This route must be PUBLIC (no Clerk auth) — Stripe sends unauthenticated
 * POST requests. See src/proxy.ts for the public route allowlist.
 *
 * To test locally:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   stripe trigger checkout.session.completed
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Skip webhook in mock mode — checkout route handles mock advancement directly.
  if (process.env.STRIPE_MODE === 'mock') {
    return NextResponse.json({ received: true, mock: true });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('[stripe/webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set.');
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: import('stripe').Stripe.Event;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[stripe/webhook] Signature verification failed: ${msg}`);
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 });
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session;
    const assessmentId = session.metadata?.assessmentId;
    const orgId = session.metadata?.orgId;

    if (!assessmentId || !orgId) {
      console.warn('[stripe/webhook] Session missing metadata.assessmentId or metadata.orgId');
      return NextResponse.json({ received: true });
    }

    try {
      const { db } = await import('@/db');
      const { assessments } = await import('@/db/schema');
      const { eq, and } = await import('drizzle-orm');

      await db
        .update(assessments)
        .set({ status: 'complete', completedAt: new Date() })
        .where(
          and(
            eq(assessments.id, assessmentId),
            eq(assessments.orgId, orgId)
          )
        );

      console.log(`[stripe/webhook] Assessment ${assessmentId} advanced to 'complete'.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[stripe/webhook] DB update failed: ${msg}`);
      // Return 200 so Stripe doesn't retry — log and investigate separately
    }
  }

  return NextResponse.json({ received: true });
}
