/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Windows Node.js 20 OpenSSL workaround ────────────────────────────────
  // Windows Node.js 20 has a race condition in InitializeBundledRootCertificates
  // when many build workers initialize SSL concurrently. Limiting workers to ≤ 4
  // prevents the assertion failure on development machines.
  // This has no effect in Docker (Linux) where the race does not occur.
  ...(process.platform === 'win32' && {
    experimental: {
      cpus: 4,
    },
  }),
};

export default nextConfig;
