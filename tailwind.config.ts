import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          brown: {
            DEFAULT: "#42291F",
            dark: "#2A1913",
            light: "#5A382A",
          },
          copper: {
            DEFAULT: "#C96D35",
            hover: "#B65F29",
            light: "#E8A46D",
            accent: "#D78649",
          },
        },
        establo: {
          bg: {
            light: "#FAF8F5",
            dark: "#121416",
          },
          surface: {
            light: "#FFFFFF",
            dark: "#1D2023",
            darkElevated: "#292D31",
          },
          border: {
            light: "#E8E0D8",
            dark: "#383C40",
          },
          text: {
            primaryLight: "#241E1A",
            secondaryLight: "#746B65",
            primaryDark: "#F5F3F0",
            secondaryDark: "#B3ACA5",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

