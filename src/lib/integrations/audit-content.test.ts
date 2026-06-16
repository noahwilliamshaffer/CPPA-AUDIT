import { describe, it, expect } from 'vitest';
import { auditSummaryHtml, auditSummaryNotionBlocks } from './audit-content';
import type { RemediationTicket } from '@/lib/tickets';

const ticket: RemediationTicket = {
  key: 'SA-Q-05',
  summary: '[§7123(c)(2)] Encrypt <PI> in transit',
  componentNumber: 2,
  component: '§7123(c)(2) — Encryption',
  citation: '§7123(c)(2)',
  priority: 'Highest',
  riskWeight: 'critical',
  response: 'no',
  labels: ['ShieldAudit', 'CCPA'],
  description: 'Finding: gap.\nRecommended remediation: enforce TLS.',
};

describe('auditSummaryHtml', () => {
  it('escapes HTML special characters from ticket content', () => {
    const html = auditSummaryHtml('Acme', [ticket]);
    expect(html).toContain('&lt;PI&gt;');
    expect(html).not.toContain('<PI>');
  });

  it('renders a table and the org name', () => {
    const html = auditSummaryHtml('Acme', [ticket]);
    expect(html).toContain('<table>');
    expect(html).toContain('Acme');
  });

  it('handles zero findings gracefully', () => {
    expect(auditSummaryHtml('Acme', [])).toContain('No open remediation items');
  });
});

describe('auditSummaryNotionBlocks', () => {
  it('returns valid Notion block objects including a heading', () => {
    const blocks = auditSummaryNotionBlocks('Acme', [ticket]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b.object).toBe('block');
    expect(blocks.some((b) => b.type === 'heading_2')).toBe(true);
  });
});
