/**
 * POST /api/scoring/calculate
 * Calculates risk-weighted scores for all answered §7123(c) components and
 * stores the results in component_scores. Advances assessment status from
 * draft/in_progress → scoring.
 *
 * Scoring algorithm:
 *   Yes = 100 pts | Partial = 50 pts | No = 0 pts | N/A = excluded
 *   Risk weight multipliers: critical=4 high=3 medium=2 low=1
 *   Component score = (Σ weighted pts / Σ max weighted pts) × 100
 *   Traffic light: Green≥80, Yellow 50–79, Red<50
 */

import { NextResponse } from 'next/server';

const WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const POINTS: Record<string, number | null> = {
  yes: 100,
  partial: 50,
  no: 0,
  not_applicable: null,
};

function trafficLight(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

export async function POST() {
  const userId = 'local-user';
  

  const { db } = await import('@/db');
  const { userRoles, assessments, answers, questions, componentScores } = await import('@/db/schema');
  const { eq, desc, and } = await import('drizzle-orm');

  const roleRows = await db
    .select({ orgId: userRoles.orgId })
    .from(userRoles)
    .where(eq(userRoles.clerkUserId, userId))
    .limit(1);
  if (roleRows.length === 0) return NextResponse.json({ error: 'No org found.' }, { status: 404 });
  const { orgId } = roleRows[0];

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

  // Fetch all answers joined with question metadata for this assessment
  const rows = await db
    .select({
      componentNumber: questions.componentNumber,
      riskWeight: questions.riskWeight,
      response: answers.response,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId)));

  // Aggregate per component
  const componentMap = new Map<number, { weightedPoints: number; maxWeightedPoints: number }>();
  for (const row of rows) {
    const mult = WEIGHT[row.riskWeight] ?? 1;
    const pts = POINTS[row.response];
    if (!componentMap.has(row.componentNumber)) {
      componentMap.set(row.componentNumber, { weightedPoints: 0, maxWeightedPoints: 0 });
    }
    const comp = componentMap.get(row.componentNumber)!;
    if (pts !== null) {
      comp.weightedPoints += pts * mult;
      comp.maxWeightedPoints += 100 * mult;
    }
  }

  // Build score records
  const scoreRecords = Array.from(componentMap.entries()).map(([componentNumber, { weightedPoints, maxWeightedPoints }]) => {
    const score = maxWeightedPoints > 0 ? Math.round((weightedPoints / maxWeightedPoints) * 100) : 0;
    return { assessmentId, componentNumber, score, status: trafficLight(score) };
  });

  // Replace all component scores for this assessment
  await db.delete(componentScores).where(eq(componentScores.assessmentId, assessmentId));
  if (scoreRecords.length > 0) {
    await db.insert(componentScores).values(scoreRecords);
  }

  // Advance status to 'scoring' if still in an early draft state
  if (status === 'draft' || status === 'in_progress') {
    await db
      .update(assessments)
      .set({ status: 'scoring' })
      .where(eq(assessments.id, assessmentId));
  }

  const overallScore =
    scoreRecords.length > 0
      ? Math.round(scoreRecords.reduce((sum, s) => sum + s.score, 0) / scoreRecords.length)
      : 0;

  return NextResponse.json({ ok: true, overallScore, componentCount: scoreRecords.length });
}
