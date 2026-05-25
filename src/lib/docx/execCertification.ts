/**
 * Document B — Executive Officer Certification generator
 *
 * Generates the executive certification per Cal. Code Regs. tit. 11, §7122(a)(5).
 * The executive officer certifies that the audit was conducted per §7122–§7123.
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
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecCertificationInput {
  orgName: string;
  legalEntity: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  generatedAt: string;
  overallScore: number | null;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  scoredComponents: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIGHT_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } as const;
const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;

function p(text: string, opts?: { bold?: boolean; italic?: boolean; center?: boolean; size?: number; color?: string; spaceBefore?: number; spaceAfter?: number }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italic,
        size: opts?.size ?? 22,
        color: opts?.color,
      }),
    ],
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: opts?.spaceBefore ?? 0, after: opts?.spaceAfter ?? 120 },
  });
}

function spacer(n = 1): Paragraph[] {
  return Array.from({ length: n }, () => new Paragraph({ text: '', spacing: { after: 160 } }));
}

function signatureLine(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: '_'.repeat(48), size: 20 }),
    ],
    spacing: { after: 200 },
  });
}

function infoRow(label: string, value: string, labelPct = 30): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: labelPct, type: WidthType.PERCENTAGE },
        borders: { top: NONE_BORDER, bottom: LIGHT_BORDER, left: NONE_BORDER, right: NONE_BORDER },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })], spacing: { after: 80 } })],
      }),
      new TableCell({
        width: { size: 100 - labelPct, type: WidthType.PERCENTAGE },
        borders: { top: NONE_BORDER, bottom: LIGHT_BORDER, left: NONE_BORDER, right: NONE_BORDER },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })], spacing: { after: 80 } })],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateExecCertificationDocx(input: ExecCertificationInput): Promise<Buffer> {
  const {
    orgName, legalEntity, auditPeriodStart, auditPeriodEnd,
    generatedAt, overallScore, greenCount, yellowCount, redCount, scoredComponents,
  } = input;

  const overallText = overallScore !== null ? `${overallScore}/100` : 'Pending';
  const classificationText =
    overallScore === null ? 'Pending'
    : overallScore >= 80 ? 'GREEN — Satisfactory'
    : overallScore >= 50 ? 'YELLOW — Needs Improvement'
    : 'RED — Critical Deficiencies Found';

  const doc = new Document({
    creator: 'ShieldAudit Platform',
    title: `Executive Certification — ${orgName}`,
    description: 'Executive Officer Certification per Cal. Code Regs. tit. 11, §7122(a)(5)',
    sections: [
      {
        properties: {},
        children: [
          // ── Title block ────────────────────────────────────────────────────
          ...spacer(3),
          p('EXECUTIVE OFFICER CERTIFICATION', { bold: true, size: 48, center: true, spaceAfter: 80 }),
          p('Cybersecurity Audit — California Privacy Protection Agency', { center: true, size: 24, color: '555555', spaceAfter: 60 }),
          p('Cal. Code Regs. tit. 11, §7122(a)(5)', { center: true, size: 22, italic: true, color: '777777', spaceAfter: 400 }),
          p('CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED', { bold: true, size: 20, center: true, color: 'CC0000', spaceAfter: 400 }),

          // ── Organization info table ────────────────────────────────────────
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow('Organization', orgName),
              infoRow('Legal Entity', legalEntity),
              infoRow('Audit Period', `${auditPeriodStart} – ${auditPeriodEnd}`),
              infoRow('Report Date', generatedAt),
              infoRow('Overall Score', `${overallText} — ${classificationText}`),
              infoRow('Components Scored', `${scoredComponents} of 18`),
              infoRow('Green / Yellow / Red', `${greenCount} / ${yellowCount} / ${redCount}`),
            ],
          }),

          ...spacer(2),

          // ── Certification statement ────────────────────────────────────────
          p('CERTIFICATION STATEMENT', { bold: true, size: 26, spaceAfter: 120 }),
          p(
            `I, the undersigned Executive Officer of ${orgName} (${legalEntity}), do hereby certify to the California Privacy Protection Agency as follows:`,
            { spaceAfter: 160 }
          ),
          new Paragraph({
            children: [new TextRun({ text: '1.', bold: true, size: 22 }), new TextRun({ text: '  Independent Cybersecurity Audit Conducted. A cybersecurity audit was conducted for the audit period identified above covering all eighteen (18) components enumerated in Cal. Code Regs. tit. 11, §7123(c) that are applicable to the business\'s information systems.' })],
            spacing: { before: 80, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '2.', bold: true, size: 22 }), new TextRun({ text: '  Auditor Independence. The audit was conducted by an independent auditor who meets the qualification requirements of Cal. Code Regs. tit. 11, §7122(a)(3), including errors & omissions (E&O) insurance. The auditor does not have a conflict of interest with the business.' })],
            spacing: { before: 80, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '3.', bold: true, size: 22 }), new TextRun({ text: '  Evidence-Based Findings. The audit findings are based on document review, technical testing, and personnel interviews as required by §7123(e), and are not based solely on management assertions.' })],
            spacing: { before: 80, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '4.', bold: true, size: 22 }), new TextRun({ text: '  Accuracy. I have reviewed the attached cybersecurity audit report (Document A) and certify that the information contained therein is true and correct to the best of my knowledge, information, and belief.' })],
            spacing: { before: 80, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: '5.', bold: true, size: 22 }), new TextRun({ text: '  Remediation Commitment. Where the audit identified deficiencies (Yellow or Red classifications), the business commits to remediating such deficiencies in accordance with a remediation plan and timeline consistent with regulatory requirements.' })],
            spacing: { before: 80, after: 200 },
          }),

          ...spacer(),

          // ── Signature block ────────────────────────────────────────────────
          p('EXECUTIVE OFFICER SIGNATURE', { bold: true, size: 24, spaceAfter: 160 }),
          signatureLine('Signature'),
          signatureLine('Printed Name'),
          signatureLine('Title'),
          signatureLine('Date of Certification'),

          ...spacer(),

          // ── Witness / Notary ───────────────────────────────────────────────
          p('ACKNOWLEDGMENT (Optional — attach notary certificate if required by jurisdiction)', { bold: true, size: 20, color: '555555', spaceAfter: 120 }),
          signatureLine('Witness / Notary Name'),
          signatureLine('Notary Commission #'),
          signatureLine('Notary Expiration Date'),
          signatureLine('Date of Notarization'),

          ...spacer(),

          // ── Footer ────────────────────────────────────────────────────────
          p('This document was generated by the ShieldAudit platform (ApexShield LLC) and must be retained for a minimum of five (5) years from the date of generation per Cal. Code Regs. tit. 11, §7123.', {
            italic: true,
            size: 18,
            color: '888888',
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
