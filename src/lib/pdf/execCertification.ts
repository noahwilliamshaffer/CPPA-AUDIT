/**
 * src/lib/pdf/execCertification.ts
 *
 * Document B — CPPA Executive Officer Certification (PDF)
 * Cal. Code Regs. tit. 11, §7122(a)(5)
 *
 * Generated using PDFKit (no browser dependency — safe in Docker/Node.js).
 * Returns a Buffer containing the complete PDF binary.
 */

import PDFDocument from 'pdfkit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExecCertificationInput {
  orgName: string;
  legalEntity: string | null;
  auditPeriodStart: string | null;
  auditPeriodEnd: string | null;
  generatedAt: string;
  overallScore: number | null;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  scoredComponents: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = {
  navy: '#1e2a3a',
  teal: '#2dd4bf',
  slate: '#64748b',
  slateLight: '#94a3b8',
  white: '#ffffff',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  lightGray: '#f1f5f9',
  border: '#e2e8f0',
  darkText: '#0f172a',
  bodyText: '#334155',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function scoreColor(score: number | null): string {
  if (score === null) return COLORS.slate;
  if (score >= 80) return COLORS.green;
  if (score >= 50) return COLORS.yellow;
  return COLORS.red;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateExecCertificationPdf(input: ExecCertificationInput): Promise<Buffer> {
  const {
    orgName,
    legalEntity,
    auditPeriodStart,
    auditPeriodEnd,
    generatedAt,
    overallScore,
    greenCount,
    yellowCount,
    redCount,
    scoredComponents,
  } = input;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 70, right: 70 },
      info: {
        Title: `CPPA Executive Officer Certification — ${orgName}`,
        Author: 'ShieldAudit by ApexShield LLC',
        Subject: 'Cal. Code Regs. tit. 11, §7122(a)(5) Executive Officer Certification',
        Creator: 'ShieldAudit',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 70;
    const contentW = pageW - margin * 2;

    // ── PAGE 1: Certification Document ────────────────────────────────────

    // Dark header band
    doc.rect(0, 0, pageW, 180).fill(COLORS.navy);
    doc.rect(0, 180, pageW, 3).fill(COLORS.teal);

    // Logo / brand
    doc
      .fillColor(COLORS.teal)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SHIELDAUDIT', margin, 44, { characterSpacing: 3 });

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(7.5)
      .font('Helvetica')
      .text('BY APEXSHIELD LLC', margin, 58, { characterSpacing: 2 });

    // Document title
    doc
      .fillColor(COLORS.white)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('EXECUTIVE OFFICER CERTIFICATION', margin, 90);

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(9)
      .font('Helvetica')
      .text('Cybersecurity Audit Certification | Cal. Code Regs. tit. 11, §7122(a)(5)', margin, 118);

    // Document B badge
    doc.rect(pageW - margin - 90, 44, 90, 26).fill('#2dd4bf22');
    doc
      .fillColor(COLORS.teal)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('DOCUMENT B', pageW - margin - 90, 49, { width: 90, align: 'center', characterSpacing: 1 });
    doc
      .fillColor(COLORS.teal)
      .fontSize(7)
      .font('Helvetica')
      .text('§7122(a)(5)', pageW - margin - 90, 60, { width: 90, align: 'center' });

    // Org & period info line
    doc
      .fillColor(COLORS.white)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(orgName, margin, 145, { width: contentW - 100 });

    if (legalEntity) {
      doc
        .fillColor(COLORS.slateLight)
        .fontSize(8.5)
        .font('Helvetica')
        .text(legalEntity, margin, 161, { width: contentW });
    }

    // ── Info block ─────────────────────────────────────────────────────────
    let y = 202;

    const infoItems = [
      ['Organization', orgName],
      ['Legal Entity / DBA', legalEntity ?? 'N/A'],
      ['Audit Period', `${fmtDate(auditPeriodStart)} – ${fmtDate(auditPeriodEnd)}`],
      ['Certification Date', generatedAt],
      ['Regulation', 'Cal. Code Regs. tit. 11, §7122(a)(5)'],
      ['Prepared By', 'ShieldAudit — ApexShield LLC'],
    ];

    const col1X = margin;
    const col2X = margin + contentW / 2 + 4;
    const colW = contentW / 2 - 8;

    infoItems.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? col1X : col2X;
      const row = Math.floor(i / 2);
      const rowY = y + row * 42;

      doc.rect(x, rowY, colW, 36).fill(COLORS.lightGray);
      doc.rect(x, rowY, colW, 36).lineWidth(0.3).stroke(COLORS.border);
      doc
        .fillColor(COLORS.slate)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 10, rowY + 8, { characterSpacing: 0.3, width: colW - 12 });
      doc
        .fillColor(COLORS.darkText)
        .fontSize(9)
        .font('Helvetica')
        .text(value, x + 10, rowY + 20, { width: colW - 12 });
    });

    y += Math.ceil(infoItems.length / 2) * 42 + 10;

    // ── Audit score summary ────────────────────────────────────────────────
    doc.rect(margin, y, contentW, 52).fill(COLORS.navy);
    doc.rect(margin, y, 5, 52).fill(scoreColor(overallScore));

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text('AUDIT SCORE SUMMARY', margin + 16, y + 10, { characterSpacing: 1 });

    doc
      .fillColor(scoreColor(overallScore))
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(overallScore !== null ? `${overallScore}%` : 'N/A', margin + 16, y + 22);

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(7.5)
      .font('Helvetica')
      .text(`Overall | ${scoredComponents}/18 components assessed`, margin + 16, y + 44);

    const statItems = [
      { label: 'Compliant', value: greenCount, color: COLORS.green },
      { label: 'Partial', value: yellowCount, color: COLORS.yellow },
      { label: 'Non-Compliant', value: redCount, color: COLORS.red },
    ];

    statItems.forEach((stat, i) => {
      const sx = margin + 180 + i * 90;
      doc.fillColor(stat.color).fontSize(16).font('Helvetica-Bold').text(String(stat.value), sx, y + 18);
      doc.fillColor(COLORS.slateLight).fontSize(7).font('Helvetica').text(stat.label, sx, y + 36);
    });

    y += 64;

    // ── Certification clauses ──────────────────────────────────────────────
    doc
      .fillColor(COLORS.navy)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('CERTIFICATION STATEMENT', margin, y);

    y += 6;
    doc.rect(margin, y, contentW, 1).fill(COLORS.teal);
    y += 12;

    doc
      .fillColor(COLORS.bodyText)
      .fontSize(8.5)
      .font('Helvetica')
      .text(
        `The undersigned, as an executive officer of ${orgName}${legalEntity ? ` (${legalEntity})` : ''}, hereby certifies each of the following statements under penalty of perjury pursuant to California law:`,
        margin,
        y,
        { width: contentW, lineGap: 2 }
      );

    y = doc.y + 14;

    const clauses = [
      {
        num: '1.',
        text: `A cybersecurity audit was conducted for the audit period from ${fmtDate(auditPeriodStart)} through ${fmtDate(auditPeriodEnd)}, covering all eighteen (18) cybersecurity program components specified in Cal. Code Regs. tit. 11, §7123(c).`,
      },
      {
        num: '2.',
        text: 'The audit was conducted by a qualified independent auditor with relevant cybersecurity expertise, in accordance with the independence requirements set forth in Cal. Code Regs. tit. 11, §7122(a)(3).',
      },
      {
        num: '3.',
        text: `The full written Cybersecurity Audit Report (Document A) has been prepared in accordance with §7123(d) and §7123(e), is dated ${generatedAt}, and accurately reflects the findings of the audit.`,
      },
      {
        num: '4.',
        text: "The organization's cybersecurity program is reasonably designed to protect the confidentiality, integrity, and availability of consumers' personal information in accordance with applicable law and regulation.",
      },
      {
        num: '5.',
        text: 'This certification and the accompanying audit report will be retained for a minimum of five (5) years from the date of certification, and will be made available to the California Privacy Protection Agency upon request pursuant to §7123(f).',
      },
    ];

    clauses.forEach((clause) => {
      if (y > pageH - 160) {
        drawFooter(doc, margin, pageW, contentW, pageH, orgName, generatedAt);
        doc.addPage();
        y = margin;
      }

      doc.rect(margin, y, 22, 22).fill(COLORS.navy);
      doc
        .fillColor(COLORS.teal)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(clause.num, margin + 2, y + 7, { width: 18, align: 'center' });

      doc
        .fillColor(COLORS.bodyText)
        .fontSize(9)
        .font('Helvetica')
        .text(clause.text, margin + 30, y + 4, { width: contentW - 30, lineGap: 2 });

      y = doc.y + 12;
    });

    y += 10;

    // ── Signature block ────────────────────────────────────────────────────
    if (y > pageH - 200) {
      drawFooter(doc, margin, pageW, contentW, pageH, orgName, generatedAt);
      doc.addPage();
      y = margin;
    }

    doc.rect(margin, y, contentW, 160).fill(COLORS.lightGray);
    doc.rect(margin, y, contentW, 160).lineWidth(0.5).stroke(COLORS.border);
    doc.rect(margin, y, 4, 160).fill(COLORS.navy);

    doc
      .fillColor(COLORS.navy)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('AUTHORIZED SIGNATURE', margin + 16, y + 14);

    doc
      .fillColor(COLORS.bodyText)
      .fontSize(8.5)
      .font('Helvetica')
      .text(
        'I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.',
        margin + 16,
        y + 30,
        { width: contentW - 32 }
      );

    const sigBaseY = y + 58;

    // Signature lines
    doc.moveTo(margin + 16, sigBaseY).lineTo(margin + 220, sigBaseY).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Signature of Executive Officer', margin + 16, sigBaseY + 4);

    doc.moveTo(margin + 240, sigBaseY).lineTo(margin + contentW - 16, sigBaseY).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Date Signed', margin + 240, sigBaseY + 4);

    doc.moveTo(margin + 16, sigBaseY + 32).lineTo(margin + 220, sigBaseY + 32).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Printed Name', margin + 16, sigBaseY + 36);

    doc.moveTo(margin + 240, sigBaseY + 32).lineTo(margin + contentW - 16, sigBaseY + 32).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Title / Position', margin + 240, sigBaseY + 36);

    doc.moveTo(margin + 16, sigBaseY + 64).lineTo(margin + contentW - 16, sigBaseY + 64).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Organization / Business Name', margin + 16, sigBaseY + 68);

    // ── Notary section ────────────────────────────────────────────────────
    y += 176;

    if (y > pageH - 180) {
      drawFooter(doc, margin, pageW, contentW, pageH, orgName, generatedAt);
      doc.addPage();
      y = margin;
    }

    doc.rect(margin, y, contentW, 120).fill(COLORS.white);
    doc.rect(margin, y, contentW, 120).lineWidth(0.5).dash(3, { space: 3 }).stroke(COLORS.slate);
    doc.undash();

    doc
      .fillColor(COLORS.slate)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('OPTIONAL: NOTARY ACKNOWLEDGMENT', margin + 16, y + 12, { characterSpacing: 0.5 });

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(7.5)
      .font('Helvetica')
      .text(
        'State of California, County of ______________________\n\nOn _________________, before me, _________________________, a Notary Public, personally appeared _________________________, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument.',
        margin + 16,
        y + 28,
        { width: contentW - 32, lineGap: 3 }
      );

    doc.moveTo(margin + 16, y + 96).lineTo(margin + 200, y + 96).lineWidth(0.5).stroke(COLORS.slateLight);
    doc.fillColor(COLORS.slateLight).fontSize(7).font('Helvetica').text('Notary Signature & Seal', margin + 16, y + 100);

    doc.moveTo(margin + 230, y + 96).lineTo(margin + contentW - 16, y + 96).lineWidth(0.5).stroke(COLORS.slateLight);
    doc.fillColor(COLORS.slateLight).fontSize(7).font('Helvetica').text('Commission Expiration', margin + 230, y + 100);

    drawFooter(doc, margin, pageW, contentW, pageH, orgName, generatedAt);
    doc.end();
  });
}

// ── Page helpers ──────────────────────────────────────────────────────────────

function drawFooter(
  doc: InstanceType<typeof PDFDocument>,
  margin: number,
  pageW: number,
  contentW: number,
  pageH: number,
  orgName: string,
  generatedAt: string
) {
  doc.rect(0, pageH - 34, pageW, 34).fill(COLORS.lightGray);
  doc.rect(0, pageH - 35, pageW, 1).fill(COLORS.border);

  doc
    .fillColor(COLORS.slate)
    .fontSize(7)
    .font('Helvetica')
    .text(`${orgName} — CPPA Executive Officer Certification`, margin, pageH - 22, { width: contentW / 2 });

  doc
    .fillColor(COLORS.slateLight)
    .fontSize(7)
    .font('Helvetica')
    .text(`Generated ${generatedAt} | CONFIDENTIAL | §7122(a)(5)`, margin, pageH - 22, { width: contentW, align: 'right' });
}
