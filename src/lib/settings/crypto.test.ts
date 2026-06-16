import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './crypto';

describe('secret encryption (AES-256-GCM)', () => {
  it('round-trips plaintext', () => {
    const secret = 'sk-ant-very-secret-token-123';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('ciphertext does not contain the plaintext', () => {
    const secret = 'plaintext-token-value';
    expect(encryptSecret(secret)).not.toContain(secret);
  });

  it('uses a fresh IV each time (same input -> different ciphertext)', () => {
    expect(encryptSecret('same-input')).not.toBe(encryptSecret('same-input'));
  });

  it('handles empty string and unicode', () => {
    expect(decryptSecret(encryptSecret(''))).toBe('');
    expect(decryptSecret(encryptSecret('é•ñ—🔐'))).toBe('é•ñ—🔐');
  });

  it('throws on tampered ciphertext (GCM auth tag)', () => {
    const raw = Buffer.from(encryptSecret('tamper-me'), 'base64');
    raw[raw.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptSecret(raw.toString('base64'))).toThrow();
  });
});
