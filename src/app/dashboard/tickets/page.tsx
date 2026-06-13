export const dynamic = 'force-dynamic';

/**
 * Remediation Tickets — /dashboard/tickets
 *
 * Turns the audit's gap findings (No / Partial answers) into actionable tickets
 * and exports them to the client's tooling (Jira, Confluence, Smartsheet,
 * SharePoint). Realizes the whiteboard flow "Remediations → become Tickets".
 */

import Link from 'next/link';
import { Ticket, Download, AlertTriangle, ChevronLeft } from 'lucide-react';
import { buildTickets, type TicketFinding, type RemediationTicket } from '@/lib/tickets';

async function fetchFindings(userId: string): Promise<{ assessmentId: string | null; findings: TicketFinding[] }> {
  const { db } = await import('@/db');
  const { userRoles, assessments, answers, questions } = await import('@/db/schema');
  const { eq, and, desc, inArray } = await import('drizzle-orm');

  const roleRows = await db.select({ orgId: userRoles.orgId }).from(userRoles).where(eq(userRoles.clerkUserId, userId)).limit(1);
  if (roleRows.length === 0) return { assessmentId: null, findings: [] };
  const { orgId } = roleRows[0];

  const assessmentRows = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.orgId, orgId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  if (assessmentRows.length === 0) return { assessmentId: null, findings: [] };
  const assessmentId = assessmentRows[0].id;

  const rows = await db
    .select({
      questionId: questions.id,
      componentNumber: questions.componentNumber,
      questionText: questions.questionText,
      riskWeight: questions.riskWeight,
      remediation: questions.remediation,
      response: answers.response,
      auditorNotes: answers.auditorNotes,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(and(eq(answers.assessmentId, assessmentId), eq(answers.orgId, orgId), inArray(answers.response, ['no', 'partial'])));

  return {
    assessmentId,
    findings: rows.map(r => ({
      questionId: r.questionId,
      componentNumber: r.componentNumber,
      questionText: r.questionText,
      riskWeight: r.riskWeight,
      response: r.response,
      auditorNotes: r.auditorNotes,
      remediation: r.remediation,
    })),
  };
}

const PRIORITY_BADGE: Record<string, string> = {
  Highest: 'text-red-400 bg-red-400/10 border border-red-400/30',
  High: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
  Medium: 'text-amber-400 bg-amber-400/10 border border-amber-400/30',
  Low: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
};

const EXPORTS = [
  { format: 'csv', label: 'CSV', hint: 'Jira · Smartsheet · SharePoint' },
  { format: 'json', label: 'JSON', hint: 'Generic API' },
  { format: 'md', label: 'Markdown', hint: 'Confluence' },
];

export default async function TicketsPage() {
  const userId = 'local-user';

  let assessmentId: string | null = null;
  let tickets: RemediationTicket[] = [];
  try {
    const data = await fetchFindings(userId);
    assessmentId = data.assessmentId;
    tickets = buildTickets(data.findings);
  } catch {
    // DB unavailable
  }

  const counts = {
    highest: tickets.filter(t => t.priority === 'Highest').length,
    high: tickets.filter(t => t.priority === 'High').length,
    other: tickets.filter(t => t.priority === 'Medium' || t.priority === 'Low').length,
  };

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-400/10">
            <Ticket size={20} className="text-teal-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Remediation</p>
            <h1 className="font-sora text-2xl font-semibold text-slate-100">Remediation Tickets</h1>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Every <span className="text-slate-300">No</span> or <span className="text-slate-300">Partial</span> finding
          becomes an actionable ticket. Export them to push into your tooling — Jira, Confluence, Smartsheet, or
          SharePoint.
        </p>
      </div>

      {/* Empty states */}
      {!assessmentId && (
        <div className="max-w-2xl rounded-xl border border-navy-600 bg-navy-600/20 p-6">
          <p className="text-sm text-slate-300 mb-1">No assessment yet</p>
          <p className="text-xs text-slate-500 mb-3">Answer the audit assessment to generate remediation tickets.</p>
          <Link href="/dashboard/assessment" className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300">
            <ChevronLeft size={12} /> Go to Audit Assessment
          </Link>
        </div>
      )}

      {assessmentId && tickets.length === 0 && (
        <div className="max-w-2xl rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-6">
          <p className="text-sm text-emerald-300 mb-1">No open remediation items</p>
          <p className="text-xs text-slate-400">
            No controls were marked No or Partial — either every assessed control is compliant, or the assessment
            isn&apos;t answered yet.
          </p>
        </div>
      )}

      {assessmentId && tickets.length > 0 && (
        <>
          {/* Summary + exports */}
          <div className="mb-6 max-w-3xl flex flex-wrap items-center justify-between gap-4 rounded-xl border border-navy-600 bg-navy-600/30 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="text-slate-200"><span className="font-semibold text-teal-400">{tickets.length}</span> tickets</span>
              <span className="text-slate-400"><span className="font-semibold text-red-400">{counts.highest}</span> highest</span>
              <span className="text-slate-400"><span className="font-semibold text-orange-400">{counts.high}</span> high</span>
              <span className="text-slate-400"><span className="font-semibold text-amber-400">{counts.other}</span> medium/low</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {EXPORTS.map(e => (
                <a
                  key={e.format}
                  href={`/api/tickets/export?format=${e.format}`}
                  title={`Export for ${e.hint}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-400/20 transition-colors"
                >
                  <Download size={12} /> {e.label}
                </a>
              ))}
            </div>
          </div>

          {/* Ticket list */}
          <div className="max-w-3xl space-y-3">
            {tickets.map(t => (
              <div key={t.key} className="rounded-xl border border-navy-600 bg-navy-600/20 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{t.key}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.Medium}`}>
                      {t.priority}
                    </span>
                    <span className="text-[10px] text-slate-600">{t.component}</span>
                    {t.response === 'no' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                        <AlertTriangle size={9} /> Not implemented
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{t.summary}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
