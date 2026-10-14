import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary buttons and highlights (soft blue with dark text)
          gold: "#DDE6FF",
          stone: "#F7F8FA",
          offwhite: "#EFF1F5",
          ink: "#1D2129",
          muted: "#667085",
          line: "#E4E7EC",
          accent: "#3F63D6",
          soft: "#EEF2FF",
          error: "#B42318",
        },
        phase: {
          gold: "#E8D6AB",
          stone: "#E4E0D8",
          graphite: "#D6D4CE",
          sand: "#E7DCC7",
          champagne: "#EFE8DC",
          dune: "#EEE3C6",
          mist: "#DEEBE9",
          pearl: "#F1EAE2",
          coral: "#EFC9B5",
          lagoon: "#CADDDC",
          harbour: "#8CB1BE",
        },
        // Outline for bars of the same name: a deeper shade of each colour.
        edge: {
          dune: "#B49A5E",
          mist: "#8FB0AB",
          pearl: "#B5A898",
          coral: "#C08466",
          lagoon: "#85A9A7",
          harbour: "#4F7A89",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
