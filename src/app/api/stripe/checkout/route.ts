/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the org's current assessment.
 * When STRIPE_MODE=mock, immediately advances the assessment to 'complete'
 * (skipping Stripe entirely) and returns { ok: true, mock: true }.
 *
 * On success with real Stripe: returns { url: checkoutSessionUrl }.
 * The client redirects the user to Stripe-hosted checkout.
 *
 * After Stripe payment, the webhook at /api/stripe/webhook advances status
 * from 'locked' → 'complete'.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const userId = 'local-user';
  

  const { db } = await import('@/db');
  const { userRoles, assessments, organizations } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  // ── Resolve org ──────────────────────────────────────────────────────────
  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) {
    return NextResponse.json({ error: 'No organization found.' }, { status: 404 });
  }
  const { orgId } = roleRows[0];

  // ── Latest assessment ────────────────────────────────────────────────────
  const assessmentRows = await db
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);

  if (assessmentRows.length === 0) {
    return NextResponse.json({ error: 'No assessment found.' }, { status: 404 });
  }

  const { id: assessmentId, status } = assessmentRows[0];

  if (status !== 'scoring') {
    return NextResponse.json(
      { error: `Assessment must be in 'scoring' status to initiate payment. Current status: ${status}` },
      { status: 400 }
    );
  }

  // ── Mock mode — skip Stripe entirely ─────────────────────────────────────
  if (process.env.STRIPE_MODE === 'mock') {
    await db
      .update(assessments)
      .set({ status: 'complete', completedAt: new Date() })
      .where(eq(assessments.id, assessmentId));

    return NextResponse.json({ ok: true, mock: true });
  }

  // ── Live Stripe mode ──────────────────────────────────────────────────────
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID_ASSESSMENT;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!stripeSecretKey || !priceId) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_ASSESSMENT.' },
      { status: 500 }
    );
  }

  // Fetch org contact email for Stripe
  const orgRows = await db
    .select({ contactEmail: organizations.contactEmail, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const orgEmail = orgRows[0]?.contactEmail;
  const orgName = orgRows[0]?.name ?? 'Organization';

  // Lazy import Stripe so it is not bundled in every route
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: orgEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      assessmentId,
      orgId,
    },
    success_url: `${appUrl}/dashboard/reports?payment=success`,
    cancel_url: `${appUrl}/dashboard/scoring?payment=cancelled`,
  });

  // Advance status to 'locked' (payment pending) and store payment intent ID
  await db
    .update(assessments)
    .set({
      status: 'locked',
      lockedAt: new Date(),
      stripePaymentIntentId: session.payment_intent as string ?? null,
    })
    .where(eq(assessments.id, assessmentId));

  return NextResponse.json({ url: session.url });
}
