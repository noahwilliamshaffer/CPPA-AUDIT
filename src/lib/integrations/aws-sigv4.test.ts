import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { signAwsRequest } from './aws-sigv4';

const fixed = new Date('2026-01-02T03:04:05.000Z');
const base = {
  method: 'PUT',
  url: 'https://evidence.s3.us-east-1.amazonaws.com/audits/report.json',
  region: 'us-east-1',
  service: 's3',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  body: 'hello world',
  date: fixed,
};

describe('signAwsRequest (SigV4)', () => {
  it('hashes the payload into x-amz-content-sha256', () => {
    const h = signAwsRequest(base);
    expect(h['x-amz-content-sha256']).toBe(crypto.createHash('sha256').update('hello world').digest('hex'));
  });

  it('formats x-amz-date from the injected date', () => {
    expect(signAwsRequest(base)['x-amz-date']).toBe('20260102T030405Z');
  });

  it('produces a well-formed Authorization header with the right credential scope', () => {
    const h = signAwsRequest(base);
    expect(h.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260102\/us-east-1\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/
    );
    expect(h.Authorization).toContain('x-amz-content-sha256');
    expect(h.Authorization).toContain('x-amz-date');
  });

  it('is deterministic for the same input + date', () => {
    expect(signAwsRequest(base).Authorization).toBe(signAwsRequest(base).Authorization);
  });

  it('changes the signature when body, date, or secret change', () => {
    const sig = (o: Partial<typeof base>) => signAwsRequest({ ...base, ...o }).Authorization.split('Signature=')[1];
    const baseSig = sig({});
    expect(sig({ body: 'different' })).not.toBe(baseSig);
    expect(sig({ date: new Date('2026-01-03T03:04:05Z') })).not.toBe(baseSig);
    expect(sig({ secretAccessKey: 'other-secret-key' })).not.toBe(baseSig);
  });

  it('signs and returns an extra content-type header', () => {
    const h = signAwsRequest({ ...base, headers: { 'content-type': 'application/json' } });
    expect(h.Authorization).toContain('content-type');
    expect(h['content-type']).toBe('application/json');
  });
});
