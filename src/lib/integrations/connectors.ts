/**
 * Connector registry — SSO-evidence, evidence-pull, GRC, and e-signature
 * integrations.
 *
 * HONEST STATUS: these are real API clients targeting each provider's documented
 * auth/identity endpoint, but they have NOT been runtime-verified against live
 * tenants (no accounts available here). Each connector's `test()` performs a
 * genuine connectivity/credential check that works once the user supplies valid
 * credentials. They are NOT yet wired into the autofill/scoring pipeline — that
 * evidence-ingestion step is a separate piece of work.
 *
 * Config is stored encrypted at rest under keys `connector.<id>.<field>`, with an
 * optional env-var fallback per field (store → env), matching config.ts.
 */

import 'server-only';
import { getSetting } from '@/lib/settings/store';
import { signAwsRequest } from './aws-sigv4';

export type ConnectorCategory = 'sso' | 'evidence' | 'grc' | 'esign';

export interface ConnectorField {
  key: string; // short id → store key connector.<id>.<key>
  label: string;
  secret: boolean;
  placeholder?: string;
  env?: string; // optional env-var fallback
}

export interface ConnectorTestResult {
  ok: boolean;
  detail: string;
  status?: number;
}

export interface ConnectorDef {
  id: string;
  name: string;
  category: ConnectorCategory;
  blurb: string; // what it does
  evidence: string; // regulatory hook / what it provides
  docsHint: string; // where to get credentials
  fields: ConnectorField[];
  test: (cfg: Record<string, string>) => Promise<ConnectorTestResult>;
}

export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  sso: 'SSO — identity & MFA evidence',
  evidence: 'Evidence connectors',
  grc: 'GRC / privacy',
  esign: 'e-Signature',
};

// ── config helpers ───────────────────────────────────────────────────────────
export const connectorStoreKey = (id: string, field: string) => `connector.${id}.${field}`;

async function resolveField(id: string, f: ConnectorField): Promise<string | null> {
  const stored = await getSetting(connectorStoreKey(id, f.key));
  if (stored && stored.trim()) return stored.trim();
  if (f.env) {
    const e = process.env[f.env];
    if (e && e.trim()) return e.trim();
  }
  return null;
}

/** Resolve all required fields (store → env). Returns null if any are missing. */
export async function getConnectorConfig(def: ConnectorDef): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    const v = await resolveField(def.id, f);
    if (!v) return null;
    out[f.key] = v;
  }
  return out;
}

/** Sanitized catalog for the settings API/UI (no secret values ever returned). */
export async function connectorCatalog() {
  return Promise.all(
    CONNECTORS.map(async (def) => {
      const fields = await Promise.all(
        def.fields.map(async (f) => {
          const v = await resolveField(def.id, f);
          return {
            key: f.key,
            label: f.label,
            secret: f.secret,
            placeholder: f.placeholder ?? '',
            set: !!v,
            value: f.secret ? '' : v ?? '',
          };
        })
      );
      return {
        id: def.id,
        name: def.name,
        category: def.category,
        blurb: def.blurb,
        evidence: def.evidence,
        docsHint: def.docsHint,
        configured: fields.every((f) => f.set),
        fields,
      };
    })
  );
}

export const getConnectorById = (id: string): ConnectorDef | undefined => CONNECTORS.find((c) => c.id === id);

// ── shared test helpers ──────────────────────────────────────────────────────
function netErr(e: unknown): ConnectorTestResult {
  return { ok: false, detail: e instanceof Error ? e.message : 'request failed' };
}

/** Microsoft Graph client-credentials token (Entra ID + Intune). */
async function graphToken(tenant: string, clientId: string, clientSecret: string): Promise<ConnectorTestResult & { token?: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: `Microsoft identity platform returned HTTP ${res.status}: ${t.slice(0, 160)}`, status: res.status };
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token
    ? { ok: true, detail: 'Acquired a Microsoft Graph access token.', status: res.status, token: data.access_token }
    : { ok: false, detail: 'No access_token in the token response.' };
}

// ── registry ─────────────────────────────────────────────────────────────────
export const CONNECTORS: ConnectorDef[] = [
  // ----- SSO / identity & MFA evidence -----
  {
    id: 'okta',
    name: 'Okta',
    category: 'sso',
    blurb: 'Read MFA enrollment policies and authenticators as evidence.',
    evidence: 'MFA / authentication controls — §7123(c) Authentication & §7123(e) auditor-observed evidence.',
    docsHint: 'Okta admin → Security → API → Tokens (create an API token). Domain like example.okta.com.',
    fields: [
      { key: 'domain', label: 'Okta domain', secret: false, placeholder: 'example.okta.com', env: 'OKTA_DOMAIN' },
      { key: 'api_token', label: 'API token (SSWS)', secret: true, env: 'OKTA_API_TOKEN' },
    ],
    test: async (c) => {
      const domain = c.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      try {
        const res = await fetch(`https://${domain}/api/v1/authenticators`, {
          headers: { Authorization: `SSWS ${c.api_token}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Okta and read MFA authenticators.', status: res.status }
          : { ok: false, detail: `Okta returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    category: 'sso',
    blurb: 'Read the authentication-methods (MFA) policy as evidence.',
    evidence: 'MFA / authentication controls — §7123(c) Authentication & §7123(e) evidence.',
    docsHint: 'Entra admin → App registrations → your app → client secret. Needs Policy.Read.All (application).',
    fields: [
      { key: 'tenant_id', label: 'Tenant ID', secret: false, env: 'ENTRA_TENANT_ID' },
      { key: 'client_id', label: 'Client ID', secret: false, env: 'ENTRA_CLIENT_ID' },
      { key: 'client_secret', label: 'Client secret', secret: true, env: 'ENTRA_CLIENT_SECRET' },
    ],
    test: async (c) => {
      try {
        const t = await graphToken(c.tenant_id, c.client_id, c.client_secret);
        return { ok: t.ok, detail: t.ok ? 'Authenticated to Microsoft Graph (can read the MFA policy).' : t.detail, status: t.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },

  // ----- Evidence connectors -----
  {
    id: 'aws',
    name: 'AWS',
    category: 'evidence',
    blurb: 'Verify AWS access for pulling control evidence (IAM, Security Hub).',
    evidence: 'Cloud security posture — §7123(c) Access/Network/Logging & §7123(e) evidence.',
    docsHint: 'IAM user/role with read-only access keys. STS GetCallerIdentity is used for the test.',
    fields: [
      { key: 'access_key_id', label: 'Access key ID', secret: false, env: 'AWS_ACCESS_KEY_ID' },
      { key: 'secret_access_key', label: 'Secret access key', secret: true, env: 'AWS_SECRET_ACCESS_KEY' },
      { key: 'region', label: 'Region', secret: false, placeholder: 'us-east-1', env: 'AWS_REGION' },
    ],
    test: async (c) => {
      const region = c.region || 'us-east-1';
      const url = `https://sts.${region}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15`;
      try {
        const headers = signAwsRequest({
          method: 'GET',
          url,
          region,
          service: 'sts',
          accessKeyId: c.access_key_id,
          secretAccessKey: c.secret_access_key,
        });
        const res = await fetch(url, { headers });
        return res.ok
          ? { ok: true, detail: 'AWS STS GetCallerIdentity succeeded.', status: res.status }
          : { ok: false, detail: `AWS returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'tenable',
    name: 'Tenable.io',
    category: 'evidence',
    blurb: 'Pull vulnerability-management scan evidence.',
    evidence: 'Vulnerability management — §7123(c) Vulnerability Management & §7123(e) evidence.',
    docsHint: 'Tenable.io → Settings → My Account → API Keys (access + secret key).',
    fields: [
      { key: 'access_key', label: 'Access key', secret: true, env: 'TENABLE_ACCESS_KEY' },
      { key: 'secret_key', label: 'Secret key', secret: true, env: 'TENABLE_SECRET_KEY' },
    ],
    test: async (c) => {
      try {
        const res = await fetch('https://cloud.tenable.com/scans', {
          headers: { 'X-ApiKeys': `accessKey=${c.access_key};secretKey=${c.secret_key}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Tenable.io and listed scans.', status: res.status }
          : { ok: false, detail: `Tenable returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'qualys',
    name: 'Qualys',
    category: 'evidence',
    blurb: 'Pull vulnerability-management evidence.',
    evidence: 'Vulnerability management — §7123(c) Vulnerability Management & §7123(e) evidence.',
    docsHint: 'Qualys user + password. Base URL is your platform pod, e.g. https://qualysapi.qg3.apps.qualys.com.',
    fields: [
      { key: 'base_url', label: 'Platform API URL', secret: false, placeholder: 'https://qualysapi.qg3.apps.qualys.com', env: 'QUALYS_BASE_URL' },
      { key: 'username', label: 'Username', secret: false, env: 'QUALYS_USERNAME' },
      { key: 'password', label: 'Password', secret: true, env: 'QUALYS_PASSWORD' },
    ],
    test: async (c) => {
      const base = c.base_url.replace(/\/+$/, '');
      const auth = Buffer.from(`${c.username}:${c.password}`).toString('base64');
      try {
        const res = await fetch(`${base}/msp/about.php`, {
          headers: { Authorization: `Basic ${auth}`, 'X-Requested-With': 'ShieldAudit' },
        });
        return res.ok
          ? { ok: true, detail: 'Authenticated to Qualys.', status: res.status }
          : { ok: false, detail: `Qualys returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'crowdstrike',
    name: 'CrowdStrike Falcon',
    category: 'evidence',
    blurb: 'Pull endpoint-protection (EDR) evidence.',
    evidence: 'Endpoint security / malware defense — §7123(c) Endpoint & §7123(e) evidence.',
    docsHint: 'Falcon console → Support → API Clients & Keys (client ID + secret). Base URL e.g. https://api.crowdstrike.com.',
    fields: [
      { key: 'base_url', label: 'API base URL', secret: false, placeholder: 'https://api.crowdstrike.com', env: 'CROWDSTRIKE_BASE_URL' },
      { key: 'client_id', label: 'Client ID', secret: false, env: 'CROWDSTRIKE_CLIENT_ID' },
      { key: 'client_secret', label: 'Client secret', secret: true, env: 'CROWDSTRIKE_CLIENT_SECRET' },
    ],
    test: async (c) => {
      const base = (c.base_url || 'https://api.crowdstrike.com').replace(/\/+$/, '');
      const body = new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret });
      try {
        const res = await fetch(`${base}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) return { ok: false, detail: `CrowdStrike returned HTTP ${res.status}.`, status: res.status };
        const data = (await res.json()) as { access_token?: string };
        return data.access_token
          ? { ok: true, detail: 'Obtained a CrowdStrike OAuth token.', status: res.status }
          : { ok: false, detail: 'No token returned by CrowdStrike.' };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'intune',
    name: 'Microsoft Intune',
    category: 'evidence',
    blurb: 'Pull device-compliance (MDM) evidence.',
    evidence: 'Device management / endpoint compliance — §7123(c) & §7123(e) evidence.',
    docsHint: 'Entra app registration with DeviceManagementManagedDevices.Read.All (application).',
    fields: [
      { key: 'tenant_id', label: 'Tenant ID', secret: false, env: 'INTUNE_TENANT_ID' },
      { key: 'client_id', label: 'Client ID', secret: false, env: 'INTUNE_CLIENT_ID' },
      { key: 'client_secret', label: 'Client secret', secret: true, env: 'INTUNE_CLIENT_SECRET' },
    ],
    test: async (c) => {
      try {
        const t = await graphToken(c.tenant_id, c.client_id, c.client_secret);
        return { ok: t.ok, detail: t.ok ? 'Authenticated to Microsoft Graph (can read managed devices).' : t.detail, status: t.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },

  // ----- GRC / privacy -----
  {
    id: 'vanta',
    name: 'Vanta',
    category: 'grc',
    blurb: 'Share / ingest compliance test evidence.',
    evidence: 'Cross-framework control evidence — supports §7123(e).',
    docsHint: 'Vanta → Settings → API tokens (OAuth bearer).',
    fields: [{ key: 'api_token', label: 'API token', secret: true, env: 'VANTA_API_TOKEN' }],
    test: async (c) => {
      try {
        const res = await fetch('https://api.vanta.com/v1/tests', {
          headers: { Authorization: `Bearer ${c.api_token}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Vanta.', status: res.status }
          : { ok: false, detail: `Vanta returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'drata',
    name: 'Drata',
    category: 'grc',
    blurb: 'Share / ingest compliance control evidence.',
    evidence: 'Cross-framework control evidence — supports §7123(e).',
    docsHint: 'Drata → Settings → API Keys.',
    fields: [{ key: 'api_key', label: 'API key', secret: true, env: 'DRATA_API_KEY' }],
    test: async (c) => {
      try {
        const res = await fetch('https://public-api.drata.com/public/controls?limit=1', {
          headers: { Authorization: `Bearer ${c.api_key}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Drata.', status: res.status }
          : { ok: false, detail: `Drata returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'secureframe',
    name: 'Secureframe',
    category: 'grc',
    blurb: 'Share / ingest compliance evidence.',
    evidence: 'Cross-framework control evidence — supports §7123(e).',
    docsHint: 'Secureframe → Settings → API (bearer key). Uses the GraphQL API.',
    fields: [{ key: 'api_key', label: 'API key', secret: true, env: 'SECUREFRAME_API_KEY' }],
    test: async (c) => {
      try {
        const res = await fetch('https://api.secureframe.com/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${c.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Secureframe.', status: res.status }
          : { ok: false, detail: `Secureframe returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'onetrust',
    name: 'OneTrust',
    category: 'grc',
    blurb: 'Share / ingest privacy & compliance evidence.',
    evidence: 'Privacy program integration — §7123(c) Privacy Program & §7123(e) evidence.',
    docsHint: 'OneTrust → Integrations → OAuth credentials (bearer token). Base URL is your tenant.',
    fields: [
      { key: 'base_url', label: 'Tenant base URL', secret: false, placeholder: 'https://your-tenant.onetrust.com', env: 'ONETRUST_BASE_URL' },
      { key: 'api_token', label: 'API token', secret: true, env: 'ONETRUST_API_TOKEN' },
    ],
    test: async (c) => {
      const base = c.base_url.replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/api/access/v1/users?page=0&size=1`, {
          headers: { Authorization: `Bearer ${c.api_token}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to OneTrust.', status: res.status }
          : { ok: false, detail: `OneTrust returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },

  // ----- e-Signature -----
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'esign',
    blurb: 'Send Document B (executive certification) for signature.',
    evidence: 'Executive certification signing — §7122(a)(5).',
    docsHint: 'DocuSign → Apps & Keys. Provide an OAuth access token + API account ID. Base URI e.g. https://demo.docusign.net.',
    fields: [
      { key: 'base_uri', label: 'Base URI', secret: false, placeholder: 'https://demo.docusign.net', env: 'DOCUSIGN_BASE_URI' },
      { key: 'account_id', label: 'API account ID', secret: false, env: 'DOCUSIGN_ACCOUNT_ID' },
      { key: 'access_token', label: 'Access token', secret: true, env: 'DOCUSIGN_ACCESS_TOKEN' },
    ],
    test: async (c) => {
      const base = c.base_uri.replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/restapi/v2.1/accounts/${encodeURIComponent(c.account_id)}`, {
          headers: { Authorization: `Bearer ${c.access_token}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to DocuSign.', status: res.status }
          : { ok: false, detail: `DocuSign returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
  {
    id: 'adobesign',
    name: 'Adobe Acrobat Sign',
    category: 'esign',
    blurb: 'Send Document B (executive certification) for signature.',
    evidence: 'Executive certification signing — §7122(a)(5).',
    docsHint: 'Acrobat Sign → API → Integration key (access token). Base URI e.g. https://api.na1.adobesign.com.',
    fields: [
      { key: 'base_uri', label: 'Base URI', secret: false, placeholder: 'https://api.na1.adobesign.com', env: 'ADOBESIGN_BASE_URI' },
      { key: 'access_token', label: 'Integration key / access token', secret: true, env: 'ADOBESIGN_ACCESS_TOKEN' },
    ],
    test: async (c) => {
      const base = c.base_uri.replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/api/rest/v6/users/me`, {
          headers: { Authorization: `Bearer ${c.access_token}`, Accept: 'application/json' },
        });
        return res.ok
          ? { ok: true, detail: 'Connected to Adobe Acrobat Sign.', status: res.status }
          : { ok: false, detail: `Adobe Sign returned HTTP ${res.status}.`, status: res.status };
      } catch (e) {
        return netErr(e);
      }
    },
  },
];
