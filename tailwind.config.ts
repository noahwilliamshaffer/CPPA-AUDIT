import type { Config } from 'tailwindcss';

/**
 * ShieldAudit design system.
 * Compliance-grade aesthetic: clean, professional, government-audit-ready.
 * Color-coded status system matches traffic light scoring throughout the app.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F1B2D',
          50: '#E8EDF4',
          100: '#C5D1E3',
          200: '#9AAFC8',
          300: '#6F8DAD',
          400: '#4F7096',
          500: '#2F5380',
          600: '#1E3A5F',
          700: '#0F1B2D',
          800: '#0A1220',
          900: '#050A12',
        },
        teal: {
          DEFAULT: '#00C4B4',
          50: '#E0FAF8',
          100: '#B3F3EE',
          200: '#80EBE4',
          300: '#4DE3D9',
          400: '#26DACE',
          500: '#00C4B4',
          600: '#009E90',
          700: '#00786D',
          800: '#00524B',
          900: '#002C28',
        },
        amber: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        crimson: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        score: {
          red: '#EF4444',
          yellow: '#F59E0B',
          green: '#22C55E',
        },
      },
      fontFamily: {
        sora: ['var(--font-sora)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
