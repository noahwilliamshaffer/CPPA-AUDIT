/**
 * Integration configuration — read from environment (set via .env / Docker).
 *
 * Env-driven (no secret-entry forms, no plaintext secrets in the DB) so it fits
 * the self-hosted Docker delivery. Each integration is "configured" only when
 * all of its required vars are present.
 */

import 'server-only';

export interface JiraConfig {
  baseUrl: string;     // https://your-site.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string;  // e.g. SEC
}

export function getJiraConfig(): JiraConfig | null {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/+$/, '');
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  if (baseUrl && email && apiToken && projectKey) return { baseUrl, email, apiToken, projectKey };
  return null;
}

export const getSlackWebhook = (): string | null => process.env.SLACK_WEBHOOK_URL?.trim() || null;
export const getTeamsWebhook = (): string | null => process.env.TEAMS_WEBHOOK_URL?.trim() || null;
export const getGenericWebhook = (): string | null => process.env.WEBHOOK_URL?.trim() || null;

export interface IntegrationStatus {
  jira: boolean;
  slack: boolean;
  teams: boolean;
  webhook: boolean;
}

export function integrationStatus(): IntegrationStatus {
  return {
    jira: !!getJiraConfig(),
    slack: !!getSlackWebhook(),
    teams: !!getTeamsWebhook(),
    webhook: !!getGenericWebhook(),
  };
}

export function anyNotifierConfigured(): boolean {
  return !!(getSlackWebhook() || getTeamsWebhook() || getGenericWebhook());
}
