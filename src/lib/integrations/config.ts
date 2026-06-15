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
  // Confluence (publish audit summary / SSP)
  confluenceBaseUrl: 'confluence.base_url',
  confluenceEmail: 'confluence.email',
  confluenceApiToken: 'confluence.api_token',
  confluenceSpaceKey: 'confluence.space_key',
  confluenceParentPageId: 'confluence.parent_page_id',
  // Notion (publish audit summary / SSP)
  notionToken: 'notion.token',
  notionParentPageId: 'notion.parent_page_id',
  // S3 / S3-compatible (evidence locker + retention)
  s3Endpoint: 's3.endpoint',
  s3Region: 's3.region',
  s3Bucket: 's3.bucket',
  s3AccessKeyId: 's3.access_key_id',
  s3SecretAccessKey: 's3.secret_access_key',
  s3Prefix: 's3.prefix',
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

// ── Confluence ────────────────────────────────────────────────────────────────
export interface ConfluenceConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string | null;
}

export async function getConfluenceConfig(): Promise<ConfluenceConfig | null> {
  const baseUrl = (await resolve(SETTING_KEYS.confluenceBaseUrl, 'CONFLUENCE_BASE_URL'))?.replace(/\/+$/, '') ?? null;
  const email = await resolve(SETTING_KEYS.confluenceEmail, 'CONFLUENCE_EMAIL');
  const apiToken = await resolve(SETTING_KEYS.confluenceApiToken, 'CONFLUENCE_API_TOKEN');
  const spaceKey = await resolve(SETTING_KEYS.confluenceSpaceKey, 'CONFLUENCE_SPACE_KEY');
  const parentPageId = await resolve(SETTING_KEYS.confluenceParentPageId, 'CONFLUENCE_PARENT_PAGE_ID');
  if (baseUrl && email && apiToken && spaceKey) return { baseUrl, email, apiToken, spaceKey, parentPageId };
  return null;
}

// ── Notion ────────────────────────────────────────────────────────────────────
export interface NotionConfig {
  token: string;
  parentPageId: string;
}

export async function getNotionConfig(): Promise<NotionConfig | null> {
  const token = await resolve(SETTING_KEYS.notionToken, 'NOTION_TOKEN');
  const parentPageId = await resolve(SETTING_KEYS.notionParentPageId, 'NOTION_PARENT_PAGE_ID');
  if (token && parentPageId) return { token, parentPageId };
  return null;
}

// ── S3 / S3-compatible ──────────────────────────────────────────────────────────
export interface S3Config {
  endpoint: string | null; // null → AWS virtual-hosted; set → path-style (MinIO/R2)
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string | null;
}

export async function getS3Config(): Promise<S3Config | null> {
  const endpoint = (await resolve(SETTING_KEYS.s3Endpoint, 'S3_ENDPOINT'))?.replace(/\/+$/, '') ?? null;
  const region = (await resolve(SETTING_KEYS.s3Region, 'S3_REGION')) ?? 'us-east-1';
  const bucket = await resolve(SETTING_KEYS.s3Bucket, 'S3_BUCKET');
  const accessKeyId = await resolve(SETTING_KEYS.s3AccessKeyId, 'S3_ACCESS_KEY_ID');
  const secretAccessKey = await resolve(SETTING_KEYS.s3SecretAccessKey, 'S3_SECRET_ACCESS_KEY');
  const prefix = await resolve(SETTING_KEYS.s3Prefix, 'S3_PREFIX');
  if (bucket && accessKeyId && secretAccessKey) return { endpoint, region, bucket, accessKeyId, secretAccessKey, prefix };
  return null;
}

export interface IntegrationStatus {
  jira: boolean;
  slack: boolean;
  teams: boolean;
  webhook: boolean;
  confluence: boolean;
  notion: boolean;
  s3: boolean;
}

export async function integrationStatus(): Promise<IntegrationStatus> {
  const [jira, slack, teams, webhook, confluence, notion, s3] = await Promise.all([
    getJiraConfig(),
    getSlackWebhook(),
    getTeamsWebhook(),
    getGenericWebhook(),
    getConfluenceConfig(),
    getNotionConfig(),
    getS3Config(),
  ]);
  return {
    jira: !!jira,
    slack: !!slack,
    teams: !!teams,
    webhook: !!webhook,
    confluence: !!confluence,
    notion: !!notion,
    s3: !!s3,
  };
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
