/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f0eee7",
        muted: "#a59d90",
        line: "#332f28",
        page: "#11100e",
        panel: "#191713",
        teal: "#8fb49a",
        amber: "#c59a5b",
        blue: "#8799bd",
        rose: "#b97969",
        green: "#9aa56f"
      },
      boxShadow: {
        workbench: "0 14px 32px rgba(0, 0, 0, 0.24)",
        lift: "0 10px 22px rgba(0, 0, 0, 0.28)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Cascadia Mono", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};
