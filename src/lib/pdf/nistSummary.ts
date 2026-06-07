/**
 * src/lib/pdf/nistSummary.ts
 *
 * ADD-17 — NIST SP 800-53 Document Summary (PDF).
 * A plain-language, auditor-facing summary of uploaded documents mapped to the
 * NIST 800-53 control families. Generated with PDFKit (no browser dependency).
 * Useful for the §7123 audit trail — "print the NIST simplified summary".
 */

import PDFDocument from 'pdfkit';

export interface NistSummaryInput {
  orgName: string;
  generatedAt: string;
  controlFamilySummaries: Record<string, string | null>;
  documentCoverage: Record<string, string[]>;
  overallReadabilityAssessment: string;
}

const COLORS = {
  navy: '#1e2a3a',
  teal: '#2dd4bf',
  slate: '#64748b',
  slateLight: '#94a3b8',
  white: '#ffffff',
  darkText: '#0f172a',
  bodyText: '#334155',
};

const FAMILY_NAMES: Record<string, string> = {
  AC: 'Access Control',
  AT: 'Awareness and Training',
  AU: 'Audit and Accountability',
  CA: 'Assessment, Authorization, and Monitoring',
  CM: 'Configuration Management',
  CP: 'Contingency Planning',
  IA: 'Identification and Authentication',
  IR: 'Incident Response',
  MA: 'Maintenance',
  MP: 'Media Protection',
  PE: 'Physical and Environmental Protection',
  PL: 'Planning',
  PM: 'Program Management',
  PS: 'Personnel Security',
  PT: 'PII Processing and Transparency',
  RA: 'Risk Assessment',
  SA: 'System and Services Acquisition',
  SC: 'System and Communications Protection',
  SI: 'System and Information Integrity',
  SR: 'Supply Chain Risk Management',
};

export async function generateNistSummaryPdf(input: NistSummaryInput): Promise<Buffer> {
  const { orgName, generatedAt, controlFamilySummaries, documentCoverage, overallReadabilityAssessment } = input;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `NIST 800-53 Document Summary — ${orgName}`,
        Author: 'ShieldAudit by ApexShield LLC',
        Subject: 'AI-assisted NIST SP 800-53 control-family summary',
        Creator: 'ShieldAudit',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 60;
    const contentW = doc.page.width - margin * 2;

    // Header band
    doc.rect(0, 0, doc.page.width, 92).fill(COLORS.navy);
    doc.rect(0, 92, doc.page.width, 3).fill(COLORS.teal);
    doc.fillColor(COLORS.teal).fontSize(10).font('Helvetica-Bold').text('SHIELDAUDIT', margin, 30, { characterSpacing: 3 });
    doc.fillColor(COLORS.white).fontSize(17).font('Helvetica-Bold').text('NIST 800-53 Document Summary', margin, 48);
    doc.fillColor(COLORS.slateLight).fontSize(8.5).font('Helvetica').text('AI-assisted, auditor reviewed', margin, 72);

    // Body
    doc.x = margin;
    doc.y = 112;
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica')
      .text(`${orgName}  ·  Generated ${generatedAt}`, { width: contentW });
    doc.moveDown(0.6);
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
      .text(
        'Plain-language summary of the uploaded cybersecurity documents, mapped to NIST SP 800-53 Rev 5 control families. AI-generated and intended for auditor reference; retain for 5 years per Cal. Code Regs. tit. 11, §7123.',
        { width: contentW, lineGap: 1.5 }
      );
    doc.moveDown(1);

    if (overallReadabilityAssessment) {
      doc.fillColor(COLORS.darkText).fontSize(9).font('Helvetica-Oblique')
        .text(overallReadabilityAssessment, { width: contentW, lineGap: 2 });
      doc.moveDown(1);
      doc.font('Helvetica');
    }

    // Document coverage
    const coverageEntries = Object.entries(documentCoverage ?? {});
    if (coverageEntries.length > 0) {
      doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold').text('Document Coverage');
      doc.moveDown(0.3);
      doc.fillColor(COLORS.bodyText).fontSize(9).font('Helvetica');
      for (const [docName, fams] of coverageEntries) {
        doc.text(`•  ${docName}:  ${(fams ?? []).join(', ') || '—'}`, { width: contentW, lineGap: 1.5 });
      }
      doc.moveDown(1);
    }

    // Control family findings
    const families = Object.entries(controlFamilySummaries ?? {}).filter(([, v]) => v != null && String(v).trim());
    doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold').text('Control Family Findings');
    doc.moveDown(0.5);

    if (families.length === 0) {
      doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica-Oblique')
        .text('No control families were addressed in the uploaded documents.', { width: contentW });
    } else {
      for (const [code, text] of families) {
        // pdfkit auto-paginates flowing text when it passes the bottom margin.
        doc.fillColor(COLORS.teal).fontSize(10).font('Helvetica-Bold')
          .text(`${code} — ${FAMILY_NAMES[code] ?? code}`, { width: contentW });
        doc.fillColor(COLORS.bodyText).fontSize(9).font('Helvetica')
          .text(String(text), { width: contentW, lineGap: 2 });
        doc.moveDown(0.8);
      }
    }

    doc.end();
  });
}
