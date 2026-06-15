/**
 * S3 (and S3-compatible: R2, MinIO, Wasabi) evidence upload — the evidence
 * locker + 5-year retention target. Plain SigV4-signed PUT via fetch (no
 * aws-sdk). When `endpoint` is set we use path-style addressing (works with
 * MinIO/R2); otherwise virtual-hosted AWS addressing.
 */

import 'server-only';
import { signAwsRequest } from './aws-sigv4';
import type { S3Config } from './config';

export interface S3UploadResult {
  ok: boolean;
  key: string;
  url: string;
  status: number;
  error?: string;
}

function encodeKey(key: string): string {
  return key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
}

export async function uploadToS3(
  cfg: S3Config,
  name: string,
  body: Buffer | string,
  contentType: string
): Promise<S3UploadResult> {
  const prefix = cfg.prefix ? cfg.prefix.replace(/^\/+|\/+$/g, '') + '/' : '';
  const key = prefix + name;
  const encodedKey = encodeKey(key);
  const url = cfg.endpoint
    ? `${cfg.endpoint.replace(/\/+$/, '')}/${cfg.bucket}/${encodedKey}` // path-style (S3-compatible)
    : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encodedKey}`; // virtual-hosted (AWS)
  const payload = typeof body === 'string' ? Buffer.from(body) : body;

  const headers = signAwsRequest({
    method: 'PUT',
    url,
    region: cfg.region,
    service: 's3',
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    body: payload,
    headers: { 'content-type': contentType },
  });

  try {
    // Buffer/Uint8Array<ArrayBufferLike> doesn't match the DOM BodyInit lib type,
    // though undici accepts it at runtime — cast to satisfy the typechecker.
    const bodyInit = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength) as unknown as BodyInit;
    const res = await fetch(url, { method: 'PUT', headers, body: bodyInit });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, key, url, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, key, url, status: res.status };
  } catch (e) {
    return { ok: false, key, url, status: 0, error: e instanceof Error ? e.message : 'request failed' };
  }
}
