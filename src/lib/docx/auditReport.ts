/**
 * Document A — Cybersecurity Audit Report generator
 *
 * Generates the full written audit report per Cal. Code Regs. tit. 11, §7123(d).
 * Covers all 18 §7123(c) components with scored findings and evidence citations.
 *
 * Retention: Must be kept for 5 years per §7123.
 * Classification: CONFIDENTIAL — Attorney-Client Privileged
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';
import { AUDIT_COMPONENTS } from '@/lib/components';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentAnswerData {
  questionId?: string;
  questionText: string;
  riskWeight: string;
  response: string;
  auditorNotes: string | null;
  aiAssisted?: boolean;
  aiConfidence?: string | null;
}

export interface ComponentReportData {
  number: number;
  score: number | null;
  status: 'green' | 'yellow' | 'red' | null;
  answers: ComponentAnswerData[];
}

export interface AiAssistedSummary {
  count: number;
  total: number;
  questionIds: string[];
}

export interface AuditReportInput {
  orgName: string;
  legalEntity: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  generatedAt: string;
  components: ComponentReportData[];
  aiAssisted?: AiAssistedSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const LIGHT_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } as const;

function heading1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 120 } });
}

function heading2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 80 } });
}

function body(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: opts?.bold, italics: opts?.italic, color: opts?.color }),
    ],
    spacing: { after: 120 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({ text: '', spacing: { after: 200 } });
}

function pageBreak(): Paragraph {
  return new Paragraph({ pageBreakBefore: true, text: '' });
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'green':  return 'GREEN (≥80)';
    case 'yellow': return 'YELLOW (50–79)';
    case 'red':    return 'RED (<50)';
    default:       return 'NOT SCORED';
  }
}

function responseLabel(r: string): string {
  switch (r) {
    case 'yes':            return 'Yes (100)';
    case 'partial':        return 'Partial (50)';
    case 'no':             return 'No (0)';
    case 'not_applicable': return 'N/A';
    default:               return r;
  }
}

function weightLabel(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

function buildCoverPage(
  orgName: string,
  legalEntity: string,
  periodStart: string,
  periodEnd: string,
  generatedAt: string
): Paragraph[] {
  return [
    spacer(),
    spacer(),
    new Paragraph({
      children: [new TextRun({ text: 'CYBERSECURITY AUDIT REPORT', bold: true, size: 56, color: '0F1B2D' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'California Privacy Protection Agency', size: 28, color: '444444' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Cal. Code Regs. tit. 11, §§7122–7123',
          size: 24,
          italics: true,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'PREPARED FOR', size: 20, bold: true, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: orgName, bold: true, size: 32, color: '0F1B2D' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: legalEntity, size: 24, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'AUDIT PERIOD', size: 20, bold: true, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${periodStart} – ${periodEnd}`, size: 28, color: '0F1B2D' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'PREPARED BY', size: 20, bold: true, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'ShieldAudit Platform', size: 24, color: '0F1B2D' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'ApexShield LLC', size: 22, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Report Generated: ${generatedAt}`, size: 20, color: '888888' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED',
          bold: true,
          size: 20,
          color: 'CC0000',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'This document contains confidential and privileged audit findings. Unauthorized disclosure is prohibited.',
          size: 18,
          color: '888888',
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    pageBreak(),
  ];
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummary(
  overallScore: number | null,
  scoredCount: number,
  totalCount: number
): Paragraph[] {
  const scoreText = overallScore !== null ? `${overallScore}/100` : 'Not Yet Scored';
  const status =
    overallScore === null
      ? 'Pending'
      : overallScore >= 80
      ? 'GREEN — Satisfactory'
      : overallScore >= 50
      ? 'YELLOW — Needs Improvement'
      : 'RED — Critical Deficiencies';

  return [
    heading1('1. Executive Summary'),
    body(
      `This report presents the results of the cybersecurity audit conducted for ${
        'the above organization'
      } pursuant to Cal. Code Regs. tit. 11, §7123. The audit assessed compliance across all eighteen (18) cybersecurity components enumerated in §7123(c), plus the Automated Decision-Making Technology (ADMT) sub-assessment (§7200–7222), evaluating the adequacy of the organization's cybersecurity program for protection of personal information as defined in Cal. Civ. Code §1798.81.5(d).`
    ),
    spacer(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall Risk Score: ', bold: true, size: 24 }),
        new TextRun({ text: scoreText, bold: true, size: 36, color: overallScore !== null && overallScore >= 80 ? '22C55E' : overallScore !== null && overallScore >= 50 ? 'F59E0B' : 'EF4444' }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Risk Classification: ', bold: true }),
        new TextRun({ text: status }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Components Scored: ', bold: true }),
        new TextRun({ text: `${scoredCount} of ${totalCount}` }),
      ],
      spacing: { after: 200 },
    }),
    body(
      'The scoring methodology applies risk-weighted points to each question: Yes=100, Partial=50, No=0, N/A excluded. Weights are Critical=4×, High=3×, Medium=2×, Low=1×. Traffic-light classification: Green≥80, Yellow 50–79, Red<50.'
    ),
    spacer(),
  ];
}

// ---------------------------------------------------------------------------
// Component Scores Summary Table
// ---------------------------------------------------------------------------

function buildScoresTable(components: ComponentReportData[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('§', true, 10),
      cell('Component', true, 44),
      cell('Score', true, 12),
      cell('Status', true, 18),
      cell('Questions', true, 16),
    ],
  });

  const dataRows = components.map((comp) => {
    const def = AUDIT_COMPONENTS.find((c) => c.number === comp.number);
    const statusText = statusLabel(comp.status);
    const scoreText = comp.score !== null ? String(comp.score) : '—';

    return new TableRow({
      children: [
        cell(`(${comp.number})`, false, 10),
        cell(def?.title ?? `Component ${comp.number}`, false, 44),
        cell(scoreText, false, 12),
        cell(statusText, false, 18),
        cell(String(comp.answers.length), false, 16),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function cell(text: string, bold: boolean, pct: number): TableCell {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    borders: {
      top: LIGHT_BORDER,
      bottom: LIGHT_BORDER,
      left: NONE_BORDER,
      right: NONE_BORDER,
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 18 })],
        spacing: { before: 60, after: 60 },
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Per-component findings
// ---------------------------------------------------------------------------

function buildComponentFindings(components: ComponentReportData[]): Paragraph[] {
  const out: Paragraph[] = [
    pageBreak(),
    heading1('2. Component-by-Component Findings'),
  ];

  for (const comp of components) {
    const def = AUDIT_COMPONENTS.find((c) => c.number === comp.number);
    if (!def) continue;

    const scoreText = comp.score !== null ? `${comp.score}/100 — ${statusLabel(comp.status)}` : 'Not Scored';

    out.push(
      heading2(`${def.citation} — ${def.title}`),
      new Paragraph({
        children: [
          new TextRun({ text: 'Description: ', bold: true }),
          new TextRun({ text: def.description, italics: true }),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Score: ', bold: true }),
          new TextRun({ text: scoreText }),
        ],
        spacing: { after: 120 },
      })
    );

    if (comp.answers.length === 0) {
      out.push(body('No questions answered for this component.', { italic: true, color: '888888' }));
    } else {
      for (const ans of comp.answers) {
        out.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Q: `, bold: true }),
              new TextRun({ text: ans.questionText }),
            ],
            spacing: { before: 80, after: 40 },
            indent: { left: 360 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Response: `, bold: true }),
              new TextRun({ text: responseLabel(ans.response) }),
              new TextRun({ text: `  |  Weight: `, color: '888888' }),
              new TextRun({ text: weightLabel(ans.riskWeight), color: '888888' }),
              ...(ans.aiAssisted
                ? [new TextRun({ text: '  (AI-assisted, auditor reviewed)', italics: true, color: '2DA89E' })]
                : []),
            ],
            spacing: { after: 40 },
            indent: { left: 360 },
          })
        );

        if (ans.auditorNotes) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Auditor Notes: ', bold: true, color: '555555' }),
                new TextRun({ text: ans.auditorNotes, italics: true, color: '555555' }),
              ],
              spacing: { after: 80 },
              indent: { left: 360 },
            })
          );
        }
      }
    }

    out.push(spacer());
  }

  return out;
}

// ---------------------------------------------------------------------------
// Methodology
// ---------------------------------------------------------------------------

function buildMethodology(): Paragraph[] {
  return [
    pageBreak(),
    heading1('3. Methodology'),
    body(
      'This audit was conducted using the ShieldAudit platform, which implements the cybersecurity audit framework required by Cal. Code Regs. tit. 11, §§7122–7123. The audit methodology consists of three primary evidence-gathering actions per §7123(e):'
    ),
    new Paragraph({
      children: [new TextRun({ text: 'A. Document Review' }), new TextRun({ text: ' — Examination of cybersecurity policies, procedures, and configuration records.', color: '555555' })],
      spacing: { after: 80 },
      indent: { left: 360 },
      bullet: { level: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'B. Technical Testing' }), new TextRun({ text: ' — Vulnerability scans, penetration test reviews, and control verification.', color: '555555' })],
      spacing: { after: 80 },
      indent: { left: 360 },
      bullet: { level: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'C. Personnel Interviews' }), new TextRun({ text: ' — Structured interviews with personnel responsible for cybersecurity controls (title only, no names recorded).', color: '555555' })],
      spacing: { after: 200 },
      indent: { left: 360 },
      bullet: { level: 0 },
    }),
    heading2('Scoring Algorithm'),
    body('Each question receives a score based on the auditor\'s response:'),
    body('Yes = 100 points | Partial = 50 points | No = 0 points | N/A = excluded from denominator'),
    body('Risk weight multipliers: Critical = 4× | High = 3× | Medium = 2× | Low = 1×'),
    body('Component score = (Σ weighted points) / (Σ maximum weighted points) × 100'),
    body('Traffic-light classification: Green ≥ 80 | Yellow 50–79 | Red < 50'),
    spacer(),
    heading2('NIST CSF & CIS Control Alignment'),
    body(
      'Questions in this audit are mapped to NIST Cybersecurity Framework (CSF) 2.0 subcategory identifiers and CIS Controls v8. These mappings are provided to facilitate gap analysis against industry frameworks but do not alter the regulatory requirements of Cal. Code Regs. tit. 11, §7123.'
    ),
  ];
}

// ---------------------------------------------------------------------------
// Regulatory references
// ---------------------------------------------------------------------------

function buildRegulatoryRefs(): Paragraph[] {
  const refs = [
    'Cal. Civ. Code §1798.81.5 — Security of personal information; definitions',
    'Cal. Civ. Code §1798.150 — Security breach; consumer right of action',
    'Cal. Code Regs. tit. 11, §7001 — Definitions (including ADMT §7001(ddd))',
    'Cal. Code Regs. tit. 11, §7120 — Applicability thresholds',
    'Cal. Code Regs. tit. 11, §7121 — General cybersecurity audit requirements',
    'Cal. Code Regs. tit. 11, §7122 — Auditor independence requirements',
    'Cal. Code Regs. tit. 11, §7123 — Cybersecurity audit scope and components',
    'Cal. Code Regs. tit. 11, §7124 — Submission requirements',
    'NIST Cybersecurity Framework (CSF) 2.0',
    'CIS Controls v8 — Center for Internet Security',
  ];

  return [
    pageBreak(),
    heading1('4. Regulatory References'),
    ...refs.map((r) =>
      new Paragraph({
        children: [new TextRun({ text: r, size: 20 })],
        spacing: { after: 80 },
        indent: { left: 360 },
        bullet: { level: 0 },
      })
    ),
    spacer(),
    heading1('5. Auditor Certification'),
    body(
      'The undersigned certifies that this cybersecurity audit was conducted in accordance with Cal. Code Regs. tit. 11, §§7121–7123, that the auditor is independent as defined in §7122(a)(3), and that the findings contained herein are accurate to the best of the auditor\'s knowledge and professional judgment.'
    ),
    spacer(),
    new Paragraph({ children: [new TextRun({ text: 'Auditor Signature: ___________________________________', size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Printed Name: _______________________________________', size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Title / Credentials: ________________________________', size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Firm Name: __________________________________________', size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Date: _______________________________________________', size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'E&O Insurance Policy #: _____________________________', size: 22 })], spacing: { after: 400 } }),
    body('This report was generated by the ShieldAudit platform (ApexShield LLC). ShieldAudit is a CPPA-compliant cybersecurity audit management system.', { italic: true, color: '888888' }),
  ];
}

// ---------------------------------------------------------------------------
// AI-assisted responses footnote (ADD-17)
// ---------------------------------------------------------------------------

function buildAiAssistedNote(ai?: AiAssistedSummary): Paragraph[] {
  if (!ai || ai.count === 0) return [];
  return [
    pageBreak(),
    heading1('Appendix: AI-Assisted Responses'),
    body(
      `${ai.count} of ${ai.total} questions in this assessment were pre-filled using AI document analysis and subsequently reviewed and accepted or overridden by the auditor.`
    ),
    body(`The following questions received AI-assisted answers: ${ai.questionIds.join(', ')}.`),
    body('All AI-generated answers were reviewed and certified by the auditor of record.', {
      italic: true,
      color: '555555',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateAuditReportDocx(input: AuditReportInput): Promise<Buffer> {
  const scoredComponents = input.components.filter((c) => c.score !== null);
  const overallScore =
    scoredComponents.length > 0
      ? Math.round(scoredComponents.reduce((s, c) => s + c.score!, 0) / scoredComponents.length)
      : null;

  const doc = new Document({
    creator: 'ShieldAudit Platform',
    title: `Cybersecurity Audit Report — ${input.orgName}`,
    description: 'CPPA Cybersecurity Audit Report per Cal. Code Regs. tit. 11, §7123(d)',
    sections: [
      {
        properties: {},
        children: [
          ...buildCoverPage(
            input.orgName,
            input.legalEntity,
            input.auditPeriodStart,
            input.auditPeriodEnd,
            input.generatedAt
          ),
          ...buildExecutiveSummary(overallScore, scoredComponents.length, input.components.length),
          buildScoresTable(input.components),
          spacer(),
          ...buildComponentFindings(input.components),
          ...buildMethodology(),
          ...buildRegulatoryRefs(),
          ...buildAiAssistedNote(input.aiAssisted),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
