import type { Config } from 'tailwindcss';

export default {
  content: ['./entrypoints/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './assets/**/*.css'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apxm: {
          bg: '#0a0a1a',
          surface: '#16213e',
          accent: '#0f3460',
          text: '#e4e4e4',
          muted: '#808080',
        },
        prun: {
          yellow: '#f7a600',
        },
        status: {
          critical: '#ef4444',
          warning: '#f59e0b',
          ok: '#22c55e',
        },
      },
      minHeight: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
