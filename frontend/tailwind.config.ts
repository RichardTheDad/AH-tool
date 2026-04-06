import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#201816",
        ember: "#b8582a",
        brass: "#d5ad6d",
        moss: "#56624f",
        slate: "#43505f",
        parchment: "#f4ecd8",
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

