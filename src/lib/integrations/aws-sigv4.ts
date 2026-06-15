/**
 * Minimal AWS Signature Version 4 signer (no aws-sdk dependency).
 *
 * Used by the S3 evidence upload and the AWS evidence connector's STS
 * GetCallerIdentity connectivity test. Signs a single request and returns the
 * headers to pass to `fetch` (Host is omitted so undici sets it from the URL —
 * the signed Host still matches because it's derived from the same URL).
 *
 * Self-contained on purpose: this app ships offline, so we avoid pulling the
 * large AWS SDK just to sign two request shapes.
 */

import 'server-only';
import crypto from 'node:crypto';

export interface SignInput {
  method: string;
  url: string; // full URL including any query string
  region: string;
  service: string; // 's3' | 'sts'
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  body?: Buffer | string; // default ''
  headers?: Record<string, string>; // extra headers to sign (e.g. content-type)
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
// AWS expects RFC-3986 encoding (encodeURIComponent leaves !*'() unescaped).
function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Returns headers (incl. Authorization) ready to spread into a fetch() call. */
export function signAwsRequest(input: SignInput): Record<string, string> {
  const { method, region, service, accessKeyId, secretAccessKey, sessionToken } = input;
  const url = new URL(input.url);
  const body = input.body ?? '';
  const payloadHash = sha256Hex(body);

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  // Headers that participate in the signature (lowercased names, trimmed values).
  const toSign: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (sessionToken) toSign['x-amz-security-token'] = sessionToken;
  for (const [k, v] of Object.entries(input.headers ?? {})) toSign[k.toLowerCase()] = String(v).trim();

  const signedHeaderNames = Object.keys(toSign).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${toSign[h]}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
    .join('&');

  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname || '/',
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Return signable headers minus Host (undici sets Host itself from the URL).
  const out: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization: authorization,
  };
  if (sessionToken) out['x-amz-security-token'] = sessionToken;
  for (const [k, v] of Object.entries(input.headers ?? {})) out[k] = v;
  return out;
}
