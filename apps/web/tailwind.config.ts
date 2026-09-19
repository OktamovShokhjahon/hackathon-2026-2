import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "#eef3f9",
        "paper-deep": "#dde7f2",
        surface: "#ffffff",
        sunken: "#e3ebf4",
        signal: "#0e7f8f",
        navy: { DEFAULT: "#0b1c2e", deep: "#07131f" },
        cyan: "#35d0e0",
        electric: "#2f5fe0",
        ai: "#6d4fd6",
        state: {
          green: "#0f8a5f",
          amber: "#b0760a",
          red: "#cf3b47",
        },
        ink: {
          DEFAULT: "#13202c",
          muted: "#4f6274",
          faint: "#7c8fa1",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "0.625rem",
        xl2: "1.25rem",
      },
      maxWidth: {
        readable: "62ch",
      },
    },
  },
  plugins: [],
};

export default config;
