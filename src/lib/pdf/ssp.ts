/**
 * src/lib/pdf/ssp.ts
 *
 * Document C — System Security Plan (PDF), the AI-drafted §7123-aligned SSP.
 * Generated with PDFKit. Retain for 5 years per Cal. Code Regs. tit. 11, §7123.
 */

import PDFDocument from 'pdfkit';

export interface SspSectionData {
  componentNumber: number;
  title: string;
  citation: string;
  narrative: string;
  gaps: string[];
}

export interface SspPdfInput {
  orgName: string;
  legalEntity: string | null;
  auditPeriodStart: string | null;
  auditPeriodEnd: string | null;
  generatedAt: string;
  executiveOverview: string;
  sections: SspSectionData[];
  aiGenerated: boolean;
}

const COLORS = {
  navy: '#1e2a3a',
  teal: '#2dd4bf',
  slate: '#64748b',
  slateLight: '#94a3b8',
  white: '#ffffff',
  darkText: '#0f172a',
  bodyText: '#334155',
  red: '#ef4444',
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function generateSspPdf(input: SspPdfInput): Promise<Buffer> {
  const { orgName, legalEntity, auditPeriodStart, auditPeriodEnd, generatedAt, executiveOverview, sections, aiGenerated } = input;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `System Security Plan — ${orgName}`,
        Author: 'ShieldAudit by ApexShield LLC',
        Subject: 'Cal. Code Regs. tit. 11, §7123 System Security Plan',
        Creator: 'ShieldAudit',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 60;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const contentW = pageW - margin * 2;

    // ── Cover ─────────────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 200).fill(COLORS.navy);
    doc.rect(0, 200, pageW, 4).fill(COLORS.teal);

    doc.fillColor(COLORS.teal).fontSize(11).font('Helvetica-Bold').text('SHIELDAUDIT', margin, 48, { characterSpacing: 3 });
    doc.fillColor(COLORS.slateLight).fontSize(8).font('Helvetica').text('BY APEXSHIELD LLC', margin, 63, { characterSpacing: 2 });
    doc.fillColor(COLORS.white).fontSize(22).font('Helvetica-Bold').text('SYSTEM SECURITY PLAN', margin, 100);
    doc.fillColor(COLORS.slateLight).fontSize(10).font('Helvetica').text('Cal. Code Regs. tit. 11, §7123  ·  NIST SP 800-53 Rev 5', margin, 128);
    doc.fillColor(COLORS.white).fontSize(13).font('Helvetica-Bold').text(orgName, margin, 155, { width: contentW - 120 });

    // Document C badge
    doc.rect(pageW - margin - 100, 48, 100, 28).fill('#2dd4bf22');
    doc.fillColor(COLORS.teal).fontSize(7).font('Helvetica-Bold').text('DOCUMENT C', pageW - margin - 100, 53, { width: 100, align: 'center', characterSpacing: 1 });
    doc.fillColor(COLORS.teal).fontSize(7).font('Helvetica').text('SSP', pageW - margin - 100, 64, { width: 100, align: 'center' });

    // Info block
    doc.x = margin;
    doc.y = 228;
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica');
    doc.text(`Legal Entity: ${legalEntity ?? 'N/A'}`, { width: contentW });
    doc.text(`Audit Period: ${fmtDate(auditPeriodStart)} – ${fmtDate(auditPeriodEnd)}`, { width: contentW });
    doc.text(`Generated: ${generatedAt}`, { width: contentW });
    doc.text(`Prepared by: ShieldAudit Platform (ApexShield LLC)${aiGenerated ? ' — AI-assisted draft, auditor review required' : ' — draft, auditor review required'}`, { width: contentW });

    doc.moveDown(1.2);

    // ── Executive Overview ────────────────────────────────────────────────────
    doc.fillColor(COLORS.navy).fontSize(13).font('Helvetica-Bold').text('Executive Overview', { width: contentW });
    doc.moveDown(0.4);
    doc.fillColor(COLORS.bodyText).fontSize(9.5).font('Helvetica').text(executiveOverview, { width: contentW, lineGap: 3 });
    doc.moveDown(1);

    // ── Per-component sections ────────────────────────────────────────────────
    doc.fillColor(COLORS.navy).fontSize(13).font('Helvetica-Bold').text('Control Implementation by Component', { width: contentW });
    doc.moveDown(0.5);

    for (const s of sections) {
      // Keep a heading from being orphaned at the very bottom of a page.
      if (doc.y > pageH - 140) doc.addPage();

      doc.fillColor(COLORS.teal).fontSize(10.5).font('Helvetica-Bold')
        .text(`${s.citation} — ${s.title}`, { width: contentW });
      doc.moveDown(0.2);
      doc.fillColor(COLORS.bodyText).fontSize(9).font('Helvetica')
        .text(s.narrative, { width: contentW, lineGap: 2 });

      if (s.gaps.length > 0) {
        doc.moveDown(0.3);
        doc.fillColor(COLORS.red).fontSize(8.5).font('Helvetica-Bold').text('Remediation items:', { width: contentW });
        doc.fillColor(COLORS.bodyText).fontSize(9).font('Helvetica');
        for (const g of s.gaps) {
          doc.text(`•  ${g}`, { width: contentW, lineGap: 1.5, indent: 6 });
        }
      }
      doc.moveDown(0.9);
    }

    // ── Closing note ──────────────────────────────────────────────────────────
    if (doc.y > pageH - 120) doc.addPage();
    doc.moveDown(0.5);
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica-Oblique').text(
      'This System Security Plan was generated by the ShieldAudit platform from the cybersecurity audit responses' +
      (aiGenerated ? ', assisted by AI document analysis,' : '') +
      ' and must be reviewed and approved by the auditor of record before use. CONFIDENTIAL — retain for 5 years per Cal. Code Regs. tit. 11, §7123.',
      { width: contentW, lineGap: 2 }
    );

    doc.end();
  });
}
