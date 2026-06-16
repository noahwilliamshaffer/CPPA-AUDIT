/**
 * src/lib/pdf/auditReport.ts
 *
 * Document A — CPPA Cybersecurity Audit Report (PDF)
 * Cal. Code Regs. tit. 11, §7123(d)
 *
 * Generated using PDFKit (no browser dependency — safe in Docker/Node.js).
 * Returns a Buffer containing the complete PDF binary.
 */

import PDFDocument from 'pdfkit';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComponentAnswer {
  questionId?: string;
  questionText: string;
  riskWeight: string;
  response: string;
  auditorNotes: string | null;
  aiAssisted?: boolean;
  aiConfidence?: string | null;
}

interface ComponentData {
  number: number;
  score: number | null;
  status: 'green' | 'yellow' | 'red' | null;
  answers: ComponentAnswer[];
}

export interface AiAssistedSummary {
  count: number;
  total: number;
  questionIds: string[];
}

export interface ReportBrand {
  firmName?: string;
  footer?: string;
}

export interface AuditReportInput {
  orgName: string;
  legalEntity: string | null;
  auditPeriodStart: string | null;
  auditPeriodEnd: string | null;
  generatedAt: string;
  components: ComponentData[];
  aiAssisted?: AiAssistedSummary;
  brand?: ReportBrand;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPONENT_NAMES: Record<number, string> = {
  1: 'Authentication',
  2: 'Encryption',
  3: 'Account Management and Access Controls',
  4: 'Inventory and Management of Personal Information',
  5: 'Secure Configuration',
  6: 'Vulnerability Management',
  7: 'Audit-Log Management',
  8: 'Network Monitoring and Defenses',
  9: 'Antivirus and Antimalware',
  10: 'Network Segmentation',
  11: 'Ports, Services, and Protocols',
  12: 'Cybersecurity Awareness',
  13: 'Cybersecurity Education and Training',
  14: 'Secure Development',
  15: 'Service Provider Oversight',
  16: 'Retention and Disposal',
  17: 'Incident Response',
  18: 'Business Continuity and Disaster Recovery',
  19: 'ADMT Sub-Assessment (§7200–7222)',
};

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

function scoreColor(status: 'green' | 'yellow' | 'red' | null): string {
  if (status === 'green') return COLORS.green;
  if (status === 'yellow') return COLORS.yellow;
  if (status === 'red') return COLORS.red;
  return COLORS.slate;
}

function scoreLabel(status: 'green' | 'yellow' | 'red' | null, score: number | null): string {
  const pct = score !== null ? `${score}%` : 'N/A';
  if (status === 'green') return `${pct} — Compliant`;
  if (status === 'yellow') return `${pct} — Partial`;
  if (status === 'red') return `${pct} — Non-Compliant`;
  return 'Not Assessed';
}

function responseLabel(response: string): string {
  const map: Record<string, string> = {
    yes: 'Yes',
    no: 'No',
    partial: 'Partial',
    na: 'N/A',
  };
  return map[response] ?? response;
}

function riskLabel(riskWeight: string): string {
  const map: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return map[riskWeight] ?? riskWeight;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateAuditReportPdf(input: AuditReportInput): Promise<Buffer> {
  const {
    orgName,
    legalEntity,
    auditPeriodStart,
    auditPeriodEnd,
    generatedAt,
    components,
    brand,
  } = input;

  const firm = brand?.firmName?.trim();
  const brandLine1 = (firm || 'SHIELDAUDIT').toUpperCase();
  const brandLine2 = firm ? brand?.footer?.trim() || '' : 'BY APEXSHIELD LLC';

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `CPPA Cybersecurity Audit Report — ${orgName}`,
        Author: 'ShieldAudit by ApexShield LLC',
        Subject: 'Cal. Code Regs. tit. 11, §7123(d) Cybersecurity Audit Report',
        Creator: 'ShieldAudit',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 60;
    const contentW = pageW - margin * 2;

    // ── PAGE 1: Cover ──────────────────────────────────────────────────────

    // Dark header band
    doc.rect(0, 0, pageW, 200).fill(COLORS.navy);

    // Teal accent line
    doc.rect(0, 200, pageW, 4).fill(COLORS.teal);

    // Logo / brand (white-label: firm name + footer override the defaults)
    doc
      .fillColor(COLORS.teal)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(brandLine1, margin, 48, { characterSpacing: 3, width: contentW - 120 });

    if (brandLine2) {
      doc
        .fillColor(COLORS.slateLight)
        .fontSize(8)
        .font('Helvetica')
        .text(brandLine2, margin, 63, { characterSpacing: 2, width: contentW - 120 });
    }

    // Main title
    doc
      .fillColor(COLORS.white)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('CYBERSECURITY AUDIT REPORT', margin, 100);

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(10)
      .font('Helvetica')
      .text('Cal. Code Regs. tit. 11, §7123(d)', margin, 128);

    // Org name in header
    doc
      .fillColor(COLORS.white)
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(orgName, margin, 155, { width: contentW - 120 });

    // Regulatory badge (top-right)
    doc.rect(pageW - margin - 100, 48, 100, 28).fill('#2dd4bf22');
    doc
      .fillColor(COLORS.teal)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('DOCUMENT A', pageW - margin - 100, 53, { width: 100, align: 'center', characterSpacing: 1 });
    doc
      .fillColor(COLORS.teal)
      .fontSize(7)
      .font('Helvetica')
      .text('§7123(d)', pageW - margin - 100, 64, { width: 100, align: 'center' });

    // Cover info block
    const infoY = 228;
    const col1 = margin;
    const col2 = margin + contentW / 2;

    const infoItems = [
      ['Organization', orgName],
      ['Legal Entity', legalEntity ?? 'N/A'],
      ['Audit Period Start', fmtDate(auditPeriodStart)],
      ['Audit Period End', fmtDate(auditPeriodEnd)],
      ['Report Generated', generatedAt],
      ['Regulatory Framework', 'Cal. Code Regs. tit. 11, §§7120–7124'],
    ];

    infoItems.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? col1 : col2;
      const y = infoY + Math.floor(i / 2) * 50;

      doc.rect(x, y, contentW / 2 - 8, 40).fill(COLORS.lightGray);
      doc
        .fillColor(COLORS.slate)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 10, y + 8, { characterSpacing: 0.5 });
      doc
        .fillColor(COLORS.darkText)
        .fontSize(9)
        .font('Helvetica')
        .text(value, x + 10, y + 20, { width: contentW / 2 - 24 });
    });

    // Overall score on cover
    const scoredComponents = components.filter((c) => c.score !== null);
    const overallScore =
      scoredComponents.length > 0
        ? Math.round(scoredComponents.reduce((s, c) => s + c.score!, 0) / scoredComponents.length)
        : null;

    const overallStatus =
      overallScore === null ? null : overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red';

    const scoreY = infoY + 180;
    doc.rect(margin, scoreY, contentW, 60).fill(COLORS.navy);
    doc.rect(margin, scoreY, 6, 60).fill(scoreColor(overallStatus));

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('OVERALL COMPLIANCE SCORE', margin + 20, scoreY + 12, { characterSpacing: 1 });

    doc
      .fillColor(scoreColor(overallStatus))
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(overallScore !== null ? `${overallScore}%` : 'N/A', margin + 20, scoreY + 26);

    const greenCount = scoreRows_from(components, 'green');
    const yellowCount = scoreRows_from(components, 'yellow');
    const redCount = scoreRows_from(components, 'red');

    doc
      .fillColor(COLORS.green)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`${greenCount} Compliant`, margin + 160, scoreY + 22);
    doc
      .fillColor(COLORS.yellow)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`${yellowCount} Partial`, margin + 280, scoreY + 22);
    doc
      .fillColor(COLORS.red)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`${redCount} Non-Compliant`, margin + 370, scoreY + 22);

    doc
      .fillColor(COLORS.slateLight)
      .fontSize(8)
      .font('Helvetica')
      .text(`${scoredComponents.length} of ${components.length} components assessed`, margin + 160, scoreY + 38);

    // Footer on cover
    doc
      .fillColor(COLORS.slateLight)
      .fontSize(7)
      .font('Helvetica')
      .text(
        'CONFIDENTIAL — Prepared by ShieldAudit under Cal. Code Regs. tit. 11, §7123(d). Retain for 5 years.',
        margin,
        pageH - 40,
        { width: contentW, align: 'center' }
      );

    // ── PAGE 2: Executive Summary ──────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc, 'EXECUTIVE SUMMARY', 'Document A — §7123(d)', margin, pageW, contentW);

    let y = 100;

    // Summary paragraph
    doc
      .fillColor(COLORS.bodyText)
      .fontSize(9.5)
      .font('Helvetica')
      .text(
        `This Cybersecurity Audit Report has been prepared for ${orgName}${legalEntity ? ` (${legalEntity})` : ''} pursuant to the California Privacy Protection Agency regulations (Cal. Code Regs. tit. 11, §§7120–7124). The audit covers the period from ${fmtDate(auditPeriodStart)} through ${fmtDate(auditPeriodEnd)} and evaluates compliance with all eighteen (18) required cybersecurity program components specified in §7123(c), plus the Automated Decision-Making Technology (ADMT) sub-assessment (§7200–7222).`,
        margin,
        y,
        { width: contentW, lineGap: 3 }
      );

    y = doc.y + 18;

    // Score summary box
    doc.rect(margin, y, contentW, 56).fill(COLORS.lightGray);
    doc.rect(margin, y, 4, 56).fill(scoreColor(overallStatus));

    doc
      .fillColor(COLORS.slate)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('AUDIT SUMMARY', margin + 16, y + 10, { characterSpacing: 1 });

    doc
      .fillColor(COLORS.darkText)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(overallScore !== null ? `${overallScore}%` : 'N/A', margin + 16, y + 24);

    doc
      .fillColor(COLORS.bodyText)
      .fontSize(8)
      .font('Helvetica')
      .text('Overall Score', margin + 16, y + 44);

    const summaryItems = [
      { label: 'Compliant (≥80%)', value: String(greenCount), color: COLORS.green },
      { label: 'Partial (50–79%)', value: String(yellowCount), color: COLORS.yellow },
      { label: 'Non-Compliant (<50%)', value: String(redCount), color: COLORS.red },
      { label: 'Not Assessed', value: String(components.length - scoredComponents.length), color: COLORS.slate },
    ];

    summaryItems.forEach((item, i) => {
      const sx = margin + 120 + i * (contentW - 120) / 4;
      doc.fillColor(item.color).fontSize(16).font('Helvetica-Bold').text(item.value, sx, y + 14);
      doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text(item.label, sx, y + 34, { width: 80 });
    });

    y = doc.y + 24;

    // Key findings
    doc
      .fillColor(COLORS.navy)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Key Findings', margin, y);

    y += 14;
    doc.moveTo(margin, y).lineTo(margin + contentW, y).lineWidth(0.5).stroke(COLORS.border);
    y += 10;

    const criticalIssues = components.filter((c) => c.status === 'red' && c.score !== null);
    const partialIssues = components.filter((c) => c.status === 'yellow' && c.score !== null);

    if (criticalIssues.length === 0 && partialIssues.length === 0) {
      doc
        .fillColor(COLORS.green)
        .fontSize(9)
        .font('Helvetica')
        .text('All assessed components achieved a Compliant score (≥80%). No critical deficiencies identified.', margin, y);
      y += 20;
    } else {
      if (criticalIssues.length > 0) {
        doc
          .fillColor(COLORS.red)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`Non-Compliant Components (${criticalIssues.length}):`, margin, y);
        y += 14;
        criticalIssues.forEach((c) => {
          doc.rect(margin, y - 1, 3, 12).fill(COLORS.red);
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(8.5)
            .font('Helvetica')
            .text(`Component ${c.number}: ${COMPONENT_NAMES[c.number]} — ${c.score}%`, margin + 10, y, { width: contentW - 10 });
          y += 14;
        });
        y += 6;
      }

      if (partialIssues.length > 0) {
        doc
          .fillColor(COLORS.yellow)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`Partial Compliance Components (${partialIssues.length}):`, margin, y);
        y += 14;
        partialIssues.forEach((c) => {
          doc.rect(margin, y - 1, 3, 12).fill(COLORS.yellow);
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(8.5)
            .font('Helvetica')
            .text(`Component ${c.number}: ${COMPONENT_NAMES[c.number]} — ${c.score}%`, margin + 10, y, { width: contentW - 10 });
          y += 14;
        });
      }
    }

    y = doc.y + 16;

    // Regulatory context
    doc
      .fillColor(COLORS.navy)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Regulatory Context', margin, y);

    y += 14;
    doc.moveTo(margin, y).lineTo(margin + contentW, y).lineWidth(0.5).stroke(COLORS.border);
    y += 10;

    const regItems = [
      { ref: '§7120', desc: 'Specifies which businesses must conduct annual cybersecurity audits.' },
      { ref: '§7122', desc: 'Defines audit requirements including scope, independence, and certification.' },
      { ref: '§7123(c)', desc: 'Enumerates the 18 cybersecurity program components evaluated in this audit.' },
      { ref: '§7123(d)', desc: 'Mandates the written cybersecurity audit report (this document).' },
      { ref: '§7123(e)', desc: 'Specifies required content of the cybersecurity audit report.' },
    ];

    regItems.forEach((item) => {
      doc.rect(margin, y, contentW, 26).fill(COLORS.lightGray);
      doc
        .fillColor(COLORS.teal)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(item.ref, margin + 10, y + 8);
      doc
        .fillColor(COLORS.bodyText)
        .fontSize(8.5)
        .font('Helvetica')
        .text(item.desc, margin + 50, y + 8, { width: contentW - 60 });
      y += 30;
    });

    drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);

    // ── PAGE 3: Component Score Summary Table ─────────────────────────────
    doc.addPage();
    drawPageHeader(doc, 'COMPONENT SCORE SUMMARY', 'Document A — §7123(d)', margin, pageW, contentW);

    y = 100;

    // Table header
    const colWidths = [40, 240, 80, 100];
    const colX = [margin, margin + 40, margin + 280, margin + 360];

    doc.rect(margin, y, contentW, 22).fill(COLORS.navy);
    const headers = ['#', 'Component Name', 'Score', 'Status'];
    headers.forEach((h, i) => {
      doc
        .fillColor(COLORS.white)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(h, colX[i] + 6, y + 7, { width: colWidths[i] - 6 });
    });

    y += 22;

    components.forEach((comp, idx) => {
      if (y > pageH - 100) {
        drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);
        doc.addPage();
        drawPageHeader(doc, 'COMPONENT SCORE SUMMARY (CONT.)', 'Document A — §7123(d)', margin, pageW, contentW);
        y = 100;

        // Re-draw table header
        doc.rect(margin, y, contentW, 22).fill(COLORS.navy);
        headers.forEach((h, i) => {
          doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold').text(h, colX[i] + 6, y + 7, { width: colWidths[i] - 6 });
        });
        y += 22;
      }

      const rowH = 24;
      const bg = idx % 2 === 0 ? COLORS.white : COLORS.lightGray;
      doc.rect(margin, y, contentW, rowH).fill(bg);
      doc.rect(margin, y, contentW, rowH).lineWidth(0.3).stroke(COLORS.border);

      // Status color bar
      if (comp.status) {
        doc.rect(colX[2], y, 3, rowH).fill(scoreColor(comp.status));
      }

      doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica-Bold').text(String(comp.number), colX[0] + 6, y + 8, { width: colWidths[0] });
      doc.fillColor(COLORS.darkText).fontSize(8).font('Helvetica').text(COMPONENT_NAMES[comp.number] ?? `Component ${comp.number}`, colX[1] + 6, y + 8, { width: colWidths[1] - 10 });
      doc
        .fillColor(comp.score !== null ? scoreColor(comp.status) : COLORS.slate)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(comp.score !== null ? `${comp.score}%` : '—', colX[2] + 10, y + 8, { width: colWidths[2] });

      const statusText = comp.status === 'green' ? 'Compliant' : comp.status === 'yellow' ? 'Partial' : comp.status === 'red' ? 'Non-Compliant' : 'Not Assessed';
      doc.fillColor(comp.status ? scoreColor(comp.status) : COLORS.slate).fontSize(8).font('Helvetica').text(statusText, colX[3] + 6, y + 8, { width: colWidths[3] });

      y += rowH;
    });

    drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);

    // ── PAGES 4+: Per-Component Findings ─────────────────────────────────
    components.forEach((comp) => {
      if (comp.answers.length === 0) return;

      doc.addPage();
      drawPageHeader(
        doc,
        `COMPONENT ${comp.number} — FINDINGS`,
        `${COMPONENT_NAMES[comp.number]}`,
        margin,
        pageW,
        contentW
      );

      y = 100;

      // Component score banner
      const bannerColor = scoreColor(comp.status);
      doc.rect(margin, y, contentW, 40).fill(COLORS.lightGray);
      doc.rect(margin, y, 5, 40).fill(bannerColor);

      doc
        .fillColor(COLORS.slate)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('COMPONENT SCORE', margin + 16, y + 8, { characterSpacing: 1 });

      doc
        .fillColor(bannerColor)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(comp.score !== null ? `${comp.score}%` : 'N/A', margin + 16, y + 18);

      doc
        .fillColor(COLORS.bodyText)
        .fontSize(8)
        .font('Helvetica')
        .text(`${COMPONENT_NAMES[comp.number]}`, margin + 80, y + 18, { width: contentW - 160 });

      y += 54;

      // Questions & answers
      comp.answers.forEach((ans, qi) => {
        const estimatedH = 80 + (ans.auditorNotes ? 30 : 0);
        if (y + estimatedH > pageH - 80) {
          drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);
          doc.addPage();
          drawPageHeader(doc, `COMPONENT ${comp.number} — FINDINGS (CONT.)`, COMPONENT_NAMES[comp.number], margin, pageW, contentW);
          y = 100;
        }

        // Question number badge
        doc.rect(margin, y, 24, 24).fill(COLORS.navy);
        doc
          .fillColor(COLORS.white)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(String(qi + 1), margin + 2, y + 8, { width: 20, align: 'center' });

        // Risk weight badge
        const riskColor = ans.riskWeight === 'critical' ? COLORS.red : ans.riskWeight === 'high' ? '#f97316' : ans.riskWeight === 'medium' ? COLORS.yellow : COLORS.green;
        doc.rect(margin + 28, y, 48, 24).fill(riskColor + '22');
        doc.fillColor(riskColor).fontSize(7).font('Helvetica-Bold').text(riskLabel(ans.riskWeight).toUpperCase(), margin + 28, y + 8, { width: 48, align: 'center', characterSpacing: 0.3 });

        // Question text
        doc
          .fillColor(COLORS.darkText)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(ans.questionText, margin + 82, y + 4, { width: contentW - 82 - 80 });

        // Response badge (right-aligned)
        const respColor =
          ans.response === 'yes' ? COLORS.green
          : ans.response === 'no' ? COLORS.red
          : ans.response === 'partial' ? COLORS.yellow
          : COLORS.slate;
        doc.rect(margin + contentW - 72, y, 72, 24).fill(respColor + '22');
        doc.fillColor(respColor).fontSize(8).font('Helvetica-Bold').text(responseLabel(ans.response), margin + contentW - 72, y + 8, { width: 72, align: 'center' });

        y += 30;

        if (ans.aiAssisted) {
          doc
            .fillColor(COLORS.teal)
            .fontSize(7)
            .font('Helvetica-Oblique')
            .text('(AI-assisted, auditor reviewed)', margin + 82, y);
          y = doc.y + 4;
        }

        if (ans.auditorNotes) {
          doc
            .fillColor(COLORS.slate)
            .fontSize(7)
            .font('Helvetica-Bold')
            .text('AUDITOR NOTES:', margin + 82, y, { characterSpacing: 0.3 });
          doc
            .fillColor(COLORS.bodyText)
            .fontSize(8.5)
            .font('Helvetica')
            .text(ans.auditorNotes, margin + 82 + 72, y, { width: contentW - 82 - 72 - 4 });
          y = doc.y + 6;
        }

        // Divider
        doc.moveTo(margin, y).lineTo(margin + contentW, y).lineWidth(0.3).stroke(COLORS.border);
        y += 10;
      });

      drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);
    });

    // ── Final page: Methodology & Signature ──────────────────────────────
    doc.addPage();
    drawPageHeader(doc, 'METHODOLOGY & AUDITOR CERTIFICATION', 'Document A — §7123(d)', margin, pageW, contentW);

    y = 100;

    // Methodology section
    const methodItems = [
      {
        title: 'Questionnaire-Based Assessment',
        body: 'Each of the 18 §7123(c) cybersecurity program components was evaluated through a structured questionnaire. Questions were designed to assess the presence, adequacy, and effectiveness of cybersecurity controls.',
      },
      {
        title: 'Risk-Weighted Scoring',
        body: 'Responses were scored using a risk-weighted algorithm: Yes = 100%, Partial = 50%, No = 0%, N/A = excluded. Each question carries a risk weight (Critical ×4, High ×3, Medium ×2, Low ×1). Component scores represent the weighted average of all applicable questions.',
      },
      {
        title: 'Compliance Thresholds',
        body: 'Component scores are classified as: Compliant (Green) ≥80%, Partial Compliance (Yellow) 50–79%, Non-Compliant (Red) <50%. The overall audit score is the arithmetic mean of all scored component scores.',
      },
      {
        title: 'Evidence Requirements',
        body: 'Auditors were prompted to attach documentary evidence for each finding. Evidence items are maintained separately and cross-referenced by question identifier in the audit working papers.',
      },
    ];

    methodItems.forEach((item) => {
      doc.rect(margin, y, 4, 0).fill(COLORS.teal); // placeholder
      doc
        .fillColor(COLORS.navy)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(item.title, margin, y);
      y += 14;
      doc
        .fillColor(COLORS.bodyText)
        .fontSize(8.5)
        .font('Helvetica')
        .text(item.body, margin, y, { width: contentW, lineGap: 2 });
      y = doc.y + 16;
    });

    y += 10;

    // Auditor signature block
    doc.rect(margin, y, contentW, 140).fill(COLORS.lightGray);
    doc.rect(margin, y, contentW, 140).lineWidth(0.5).stroke(COLORS.border);
    doc.rect(margin, y, 4, 140).fill(COLORS.teal);

    doc
      .fillColor(COLORS.navy)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('AUDITOR CERTIFICATION', margin + 16, y + 14);

    doc
      .fillColor(COLORS.bodyText)
      .fontSize(8.5)
      .font('Helvetica')
      .text(
        'I certify that this cybersecurity audit was conducted in accordance with Cal. Code Regs. tit. 11, §§7122–7123 of the California Privacy Protection Agency regulations, and that the findings contained in this report accurately reflect the cybersecurity posture of the audited organization as of the audit period end date.',
        margin + 16,
        y + 32,
        { width: contentW - 32, lineGap: 2 }
      );

    const sigY = y + 86;
    doc.moveTo(margin + 16, sigY).lineTo(margin + 220, sigY).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Auditor Signature', margin + 16, sigY + 4);

    doc.moveTo(margin + 250, sigY).lineTo(margin + 420, sigY).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Date', margin + 250, sigY + 4);

    doc.moveTo(margin + 16, sigY + 30).lineTo(margin + 220, sigY + 30).lineWidth(0.5).stroke(COLORS.slate);
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica').text('Printed Name & Credentials', margin + 16, sigY + 34);

    drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);

    // ── AI-Assisted Responses footnote (ADD-17) ──────────────────────────────
    if (input.aiAssisted && input.aiAssisted.count > 0) {
      doc.addPage();
      drawPageHeader(doc, 'AI-ASSISTED RESPONSES', 'Document A — §7123(d)', margin, pageW, contentW);

      let ay = 100;
      doc
        .fillColor(COLORS.bodyText)
        .fontSize(9.5)
        .font('Helvetica')
        .text(
          `${input.aiAssisted.count} of ${input.aiAssisted.total} questions in this assessment were pre-filled using AI document analysis and subsequently reviewed and accepted or overridden by the auditor.`,
          margin,
          ay,
          { width: contentW, lineGap: 3 }
        );

      ay = doc.y + 14;
      doc
        .fillColor(COLORS.darkText)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Questions with AI-assisted answers:', margin, ay);

      ay = doc.y + 6;
      doc
        .fillColor(COLORS.bodyText)
        .fontSize(9)
        .font('Helvetica')
        .text(input.aiAssisted.questionIds.join(', ') || 'None', margin, ay, { width: contentW, lineGap: 2 });

      ay = doc.y + 14;
      doc
        .fillColor(COLORS.slate)
        .fontSize(8.5)
        .font('Helvetica-Oblique')
        .text(
          'All AI-generated answers were reviewed and certified by the auditor of record.',
          margin,
          ay,
          { width: contentW }
        );

      drawPageFooter(doc, orgName, generatedAt, margin, pageW, contentW, pageH);
    }

    doc.end();
  });
}

// ── Page layout helpers ───────────────────────────────────────────────────────

function drawPageHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  subtitle: string,
  margin: number,
  pageW: number,
  contentW: number
) {
  doc.rect(0, 0, pageW, 60).fill(COLORS.navy);
  doc.rect(0, 60, pageW, 2).fill(COLORS.teal);

  doc
    .fillColor(COLORS.white)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(title, margin, 18);

  doc
    .fillColor(COLORS.slateLight)
    .fontSize(7.5)
    .font('Helvetica')
    .text(subtitle, margin, 34, { characterSpacing: 0.3 });

  doc
    .fillColor(COLORS.teal)
    .fontSize(7)
    .font('Helvetica-Bold')
    .text('SHIELDAUDIT', pageW - margin - 60, 24, { width: 60, align: 'right', characterSpacing: 1 });
}

function drawPageFooter(
  doc: InstanceType<typeof PDFDocument>,
  orgName: string,
  generatedAt: string,
  margin: number,
  pageW: number,
  contentW: number,
  pageH: number
) {
  doc.rect(0, pageH - 36, pageW, 36).fill(COLORS.lightGray);
  doc.rect(0, pageH - 37, pageW, 1).fill(COLORS.border);

  doc
    .fillColor(COLORS.slate)
    .fontSize(7)
    .font('Helvetica')
    .text(`${orgName} — CPPA Cybersecurity Audit Report`, margin, pageH - 24, { width: contentW / 2 });

  doc
    .fillColor(COLORS.slateLight)
    .fontSize(7)
    .font('Helvetica')
    .text(`Generated ${generatedAt} | CONFIDENTIAL`, margin, pageH - 24, { width: contentW, align: 'right' });
}

function scoreRows_from(components: ComponentData[], status: 'green' | 'yellow' | 'red'): number {
  return components.filter((c) => c.status === status).length;
}
