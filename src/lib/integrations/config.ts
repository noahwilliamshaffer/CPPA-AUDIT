/**
 * Integration configuration — resolved from the in-app settings store first
 * (tokens entered in the UI, encrypted at rest), then falling back to env vars
 * (handy for Docker/CI). All accessors are async because the store hits the DB.
 */

import 'server-only';
import { getSetting } from '@/lib/settings/store';

/** Setting keys (also used by the settings API/UI). */
export const SETTING_KEYS = {
  jiraBaseUrl: 'jira.base_url',
  jiraEmail: 'jira.email',
  jiraApiToken: 'jira.api_token',
  jiraProjectKey: 'jira.project_key',
  slackWebhookUrl: 'slack.webhook_url',
  teamsWebhookUrl: 'teams.webhook_url',
  genericWebhookUrl: 'generic.webhook_url',
  anthropicApiKey: 'anthropic.api_key',
  anthropicModel: 'anthropic.model',
} as const;

/** Stored setting first, then env, then null. */
async function resolve(key: string, envName: string): Promise<string | null> {
  const stored = await getSetting(key);
  if (stored && stored.trim()) return stored.trim();
  const env = process.env[envName];
  return env && env.trim() ? env.trim() : null;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export async function getJiraConfig(): Promise<JiraConfig | null> {
  const baseUrl = (await resolve(SETTING_KEYS.jiraBaseUrl, 'JIRA_BASE_URL'))?.replace(/\/+$/, '') ?? null;
  const email = await resolve(SETTING_KEYS.jiraEmail, 'JIRA_EMAIL');
  const apiToken = await resolve(SETTING_KEYS.jiraApiToken, 'JIRA_API_TOKEN');
  const projectKey = await resolve(SETTING_KEYS.jiraProjectKey, 'JIRA_PROJECT_KEY');
  if (baseUrl && email && apiToken && projectKey) return { baseUrl, email, apiToken, projectKey };
  return null;
}

export const getSlackWebhook = () => resolve(SETTING_KEYS.slackWebhookUrl, 'SLACK_WEBHOOK_URL');
export const getTeamsWebhook = () => resolve(SETTING_KEYS.teamsWebhookUrl, 'TEAMS_WEBHOOK_URL');
export const getGenericWebhook = () => resolve(SETTING_KEYS.genericWebhookUrl, 'WEBHOOK_URL');

export interface IntegrationStatus {
  jira: boolean;
  slack: boolean;
  teams: boolean;
  webhook: boolean;
}

export async function integrationStatus(): Promise<IntegrationStatus> {
  const [jira, slack, teams, webhook] = await Promise.all([
    getJiraConfig(),
    getSlackWebhook(),
    getTeamsWebhook(),
    getGenericWebhook(),
  ]);
  return { jira: !!jira, slack: !!slack, teams: !!teams, webhook: !!webhook };
}

export async function anyNotifierConfigured(): Promise<boolean> {
  const [s, t, w] = await Promise.all([getSlackWebhook(), getTeamsWebhook(), getGenericWebhook()]);
  return !!(s || t || w);
}

// ── AI provider (Anthropic) ──────────────────────────────────────────────────
export async function getEffectiveAnthropicKey(): Promise<string | null> {
  return resolve(SETTING_KEYS.anthropicApiKey, 'ANTHROPIC_API_KEY');
}
export async function getEffectiveAnthropicModel(): Promise<string> {
  return (await resolve(SETTING_KEYS.anthropicModel, 'ANTHROPIC_MODEL')) ?? 'claude-sonnet-4-5';
}
