import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "rgb(var(--bg-950) / <alpha-value>)",
          900: "rgb(var(--bg-900) / <alpha-value>)",
          800: "rgb(var(--bg-800) / <alpha-value>)",
          700: "rgb(var(--bg-700) / <alpha-value>)",
          600: "rgb(var(--bg-600) / <alpha-value>)",
        },
        charcoal: {
          900: "#14161b",
          800: "#1b1e25",
          700: "#252a33",
          600: "#323844",
        },
        gold: {
          300: "rgb(var(--accent-300) / <alpha-value>)",
          400: "rgb(var(--accent-400) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
          faint: "rgb(var(--faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: [
          "Manrope Variable",
          "Noto Sans Thai Variable",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "Manrope Variable",
          "Noto Sans Thai Variable",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
