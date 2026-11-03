import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b16',
          900: '#0b1222',
          800: '#111a2e',
          700: '#18243d',
          600: '#22314f',
        },
        charcoal: {
          900: '#14161b',
          800: '#1b1e25',
          700: '#252a33',
          600: '#323844',
        },
        gold: {
          300: '#f0d58a',
          400: '#e5c166',
          500: '#d4a94a',
          600: '#b88a2e',
        },
        ink: {
          DEFAULT: '#e8ebf2',
          muted: '#97a2b8',
          faint: '#68738a',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
