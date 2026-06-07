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

  // ── Native modules that must not be bundled ───────────────────────────────
  // pdfkit uses __dirname to locate AFM font data files at runtime. Turbopack
  // rewrites __dirname to /ROOT in bundled code, causing ENOENT on font files.
  // Marking pdfkit as external preserves its real __dirname (/app/node_modules).
  // docx is also excluded: it uses Node.js crypto at module-init time, which
  // triggers an assertion failure on Windows Node.js 20 during build workers.
  serverExternalPackages: ['pdfkit', 'docx', 'better-sqlite3', 'pdf-parse', 'mammoth', '@anthropic-ai/sdk'],
};

export default nextConfig;
