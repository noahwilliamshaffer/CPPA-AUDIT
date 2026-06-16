import { describe, it, expect } from 'vitest';
import { buildTickets, ticketsToCsv, ticketsToJson, ticketsToMarkdown, type TicketFinding } from './tickets';

const findings: TicketFinding[] = [
  { questionId: 'Q-05', componentNumber: 2, questionText: 'Encrypt PI in transit?', riskWeight: 'critical', response: 'no', auditorNotes: null, remediation: 'Enforce TLS 1.2+' },
  { questionId: 'Q-10', componentNumber: 3, questionText: 'Least privilege?', riskWeight: 'medium', response: 'partial', auditorNotes: 'partial rollout', remediation: null },
  { questionId: 'Q-01', componentNumber: 1, questionText: 'MFA everywhere?', riskWeight: 'high', response: 'yes', auditorNotes: null, remediation: null },
  { questionId: 'Q-99', componentNumber: 9, questionText: 'N/A item', riskWeight: 'low', response: 'not_applicable', auditorNotes: null, remediation: null },
];

describe('buildTickets', () => {
  const tickets = buildTickets(findings);

  it('only includes no/partial findings (the gaps)', () => {
    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.response).sort()).toEqual(['no', 'partial']);
  });

  it('maps risk weight to priority (critical -> Highest)', () => {
    expect(tickets.find((t) => t.riskWeight === 'critical')?.priority).toBe('Highest');
  });

  it('sorts most severe first', () => {
    expect(tickets[0].riskWeight).toBe('critical');
  });

  it('puts the citation in the summary', () => {
    expect(tickets[0].summary).toContain('§7123(c)(2)');
  });
});

describe('ticket serializers', () => {
  const tickets = buildTickets(findings);

  it('CSV has a header row plus one row per ticket', () => {
    const lines = ticketsToCsv(tickets).split('\r\n');
    expect(lines[0]).toContain('Summary');
    expect(lines).toHaveLength(tickets.length + 1);
  });

  it('JSON carries the right count', () => {
    const parsed = JSON.parse(ticketsToJson(tickets));
    expect(parsed.count).toBe(tickets.length);
    expect(parsed.tickets).toHaveLength(tickets.length);
  });

  it('Markdown includes the org name and a table header', () => {
    const md = ticketsToMarkdown(tickets, 'Acme Co');
    expect(md).toContain('Acme Co');
    expect(md).toContain('| Key |');
  });

  it('handles empty findings', () => {
    expect(buildTickets([])).toHaveLength(0);
    expect(JSON.parse(ticketsToJson([])).count).toBe(0);
  });
});
