import type { Config } from 'tailwindcss';

export default {
  content: ['./entrypoints/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './assets/**/*.css'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apxm: {
          bg: '#1a1a2e',
          surface: '#16213e',
          accent: '#0f3460',
          text: '#e4e4e4',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
