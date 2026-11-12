import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#151c19",
          900: "#1a231e",
          800: "#222d26",
          700: "#2b382f",
          600: "#3b4b3e",
        },
        charcoal: {
          900: "#14161b",
          800: "#1b1e25",
          700: "#252a33",
          600: "#323844",
        },
        gold: {
          300: "#d0e2bf",
          400: "#bdd5a7",
          500: "#afc995",
          600: "#829c77",
        },
        ink: {
          DEFAULT: "#eeeae1",
          muted: "#bbc7b9",
          faint: "#9aaa9b",
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
