import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8f7",
          100: "#deede9",
          200: "#bddbd2",
          300: "#93c0b3",
          400: "#659f90",
          500: "#4b8476",
          600: "#3b6a5f",
          700: "#31564d",
          800: "#2a4640",
          900: "#243b35"
        }
      }
    }
  },
  plugins: []
};

export default config;
