export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#f4f4f5",
                ember: "#f97316",
                brass: "#f59e0b",
                parchment: "#09090b",
            },
            letterSpacing: {
                display: "0.3em", // page/brand headings (AzerothFlip wordmark)
                label: "0.16em", // table headers, section labels
                detail: "0.18em", // metadata stat labels
                link: "0.12em", // inline action links
            },
            boxShadow: {
                card: "0 22px 50px rgba(0, 0, 0, 0.5)",
            },
            fontFamily: {
                display: ['"Sora"', '"Segoe UI"', "sans-serif"],
                body: ['"Sora"', '"Segoe UI"', "sans-serif"],
            },
        },
    },
    plugins: [],
};
