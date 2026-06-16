// Deterministic encryption key for crypto tests (avoids touching a key file).
process.env.APP_SECRET = process.env.APP_SECRET || 'vitest-app-secret-deterministic';
