import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#201816",
        ember: "#b8582a",
        brass: "#d5ad6d",
        parchment: "#f4ecd8",
      },
      letterSpacing: {
        display: "0.3em",   // page/brand headings (AzerothFlip wordmark)
        label: "0.16em",    // table headers, section labels
        detail: "0.18em",   // metadata stat labels
        link: "0.12em",     // inline action links
      },
      boxShadow: {
        card: "0 18px 40px rgba(32, 24, 22, 0.12)",
      },
      fontFamily: {
        display: ['"Trebuchet MS"', '"Gill Sans"', "sans-serif"],
        body: ['"Segoe UI"', '"Trebuchet MS"', "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

