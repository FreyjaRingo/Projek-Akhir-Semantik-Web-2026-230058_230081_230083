/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e7f0ec",
        muted: "#91a6a2",
        line: "#263842",
        page: "#0a1015",
        panel: "#111a22",
        teal: "#35b8a6",
        amber: "#d89a45",
        blue: "#73a7ff",
        rose: "#df7a9b",
        green: "#7cb56b"
      },
      boxShadow: {
        workbench: "0 18px 42px rgba(0, 0, 0, 0.28)",
        lift: "0 12px 26px rgba(0, 0, 0, 0.35)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Cascadia Mono", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};
