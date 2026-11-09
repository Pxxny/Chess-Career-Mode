import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#191c19",
          900: "#202420",
          800: "#282d28",
          700: "#313731",
          600: "#414941",
        },
        charcoal: {
          900: "#14161b",
          800: "#1b1e25",
          700: "#252a33",
          600: "#323844",
        },
        gold: {
          300: "#c7d5bf",
          400: "#b5c7ac",
          500: "#a4ba99",
          600: "#829c77",
        },
        ink: {
          DEFAULT: "#eeeae1",
          muted: "#c2c0b6",
          faint: "#a4a497",
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
