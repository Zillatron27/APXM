import type { Config } from 'tailwindcss';

export default {
  content: ['./entrypoints/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './assets/**/*.css'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Driven by CSS custom properties set per theme (see lib/theme).
        // The rgb-channel form lets Tailwind apply colour-alpha modifiers
        // (e.g. `text-apxm-text/70`).
        apxm: {
          bg: 'rgb(var(--apxm-bg-rgb) / <alpha-value>)',
          surface: 'rgb(var(--apxm-surface-rgb) / <alpha-value>)',
          accent: 'rgb(var(--apxm-accent-rgb) / <alpha-value>)',
          text: 'rgb(var(--apxm-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--apxm-muted-rgb) / <alpha-value>)',
        },
        prun: {
          // The interactive highlight. Named for legacy reasons (it was the
          // PrUn gold); now themed — green in CRT, sky blue in Colorblind, etc.
          yellow: 'rgb(var(--apxm-highlight-rgb) / <alpha-value>)',
        },
        status: {
          critical: 'rgb(var(--apxm-status-critical-rgb) / <alpha-value>)',
          warning: 'rgb(var(--apxm-status-warning-rgb) / <alpha-value>)',
          ok: 'rgb(var(--apxm-status-ok-rgb) / <alpha-value>)',
          surplus: 'rgb(var(--apxm-status-surplus-rgb) / <alpha-value>)',
        },
      },
      minHeight: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
