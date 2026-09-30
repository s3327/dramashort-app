/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // We drive theme switching with data-theme="light|soft|dark" on <html>,
  // set alongside Tailwind's class strategy so `dark:` utilities still work
  // if you ever want them.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // ---- Brand scale (static — same across all themes) ----
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          dark:    "rgb(var(--primary-dark) / <alpha-value>)",
          light:   "rgb(var(--primary-light) / <alpha-value>)",
          soft:    "rgb(var(--primary-soft) / <alpha-value>)",
          hover:   "rgb(var(--primary-hover) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          dark:    "rgb(var(--secondary-dark) / <alpha-value>)",
          light:   "rgb(var(--secondary-light) / <alpha-value>)",
          soft:    "rgb(var(--secondary-soft) / <alpha-value>)",
          hover:   "rgb(var(--secondary-hover) / <alpha-value>)",
        },
        tertiary: {
          DEFAULT: "rgb(var(--tertiary) / <alpha-value>)",
          dark:    "rgb(var(--tertiary-dark) / <alpha-value>)",
          light:   "rgb(var(--tertiary-light) / <alpha-value>)",
          soft:    "rgb(var(--tertiary-soft) / <alpha-value>)",
          hover:   "rgb(var(--tertiary-hover) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          dark:    "rgb(var(--danger-dark) / <alpha-value>)",
          light:   "rgb(var(--danger-light) / <alpha-value>)",
          soft:    "rgb(var(--danger-soft) / <alpha-value>)",
          hover:   "rgb(var(--danger-hover) / <alpha-value>)",
        },

        // ---- Semantic tokens (flip per data-theme) ----
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised:  "rgb(var(--surface-raised) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          muted:   "rgb(var(--text-muted))",
          inverse: "rgb(var(--text-inverse) / <alpha-value>)",
        },
        link: {
          DEFAULT: "rgb(var(--link) / <alpha-value>)",
          hover:   "rgb(var(--link-hover) / <alpha-value>)",
        },
        btn: {
          "primary":         "rgb(var(--btn-primary-bg) / <alpha-value>)",
          "primary-hover":   "rgb(var(--btn-primary-bg-hover) / <alpha-value>)",
          "primary-text":    "rgb(var(--btn-primary-text) / <alpha-value>)",
          "secondary":       "rgb(var(--btn-secondary-bg) / <alpha-value>)",
          "secondary-hover": "rgb(var(--btn-secondary-bg-hover) / <alpha-value>)",
          "secondary-text":  "rgb(var(--btn-secondary-text) / <alpha-value>)",
          "tertiary":        "rgb(var(--btn-tertiary-bg) / <alpha-value>)",
          "tertiary-hover":  "rgb(var(--btn-tertiary-bg-hover) / <alpha-value>)",
          "tertiary-text":   "rgb(var(--btn-tertiary-text) / <alpha-value>)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      transitionTimingFunction: {
        brand: "var(--ease-brand)",
      },
    },
  },
  plugins: [],
};
