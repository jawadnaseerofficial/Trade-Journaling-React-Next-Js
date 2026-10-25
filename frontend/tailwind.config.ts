import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        sidebar: "rgb(var(--c-sidebar) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)",
          mute: "rgb(var(--c-ink-mute) / <alpha-value>)",
        },
        primary: {
          50: "rgb(var(--c-primary-50) / <alpha-value>)",
          100: "rgb(var(--c-primary-100) / <alpha-value>)",
          300: "rgb(var(--c-primary-300) / <alpha-value>)",
          400: "rgb(var(--c-primary-400) / <alpha-value>)",
          500: "rgb(var(--c-primary-500) / <alpha-value>)",
          600: "rgb(var(--c-primary-600) / <alpha-value>)",
          700: "rgb(var(--c-primary-700) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--c-success) / <alpha-value>)",
          soft: "rgb(var(--c-success-soft) / <alpha-value>)",
          deep: "rgb(var(--c-success-deep) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          soft: "rgb(var(--c-danger-soft) / <alpha-value>)",
          deep: "rgb(var(--c-danger-deep) / <alpha-value>)",
        },
        warn: "rgb(var(--c-warn) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(21,22,46,.04), 0 4px 16px rgba(21,22,46,.06)",
      },
      borderRadius: { card: "10px" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;