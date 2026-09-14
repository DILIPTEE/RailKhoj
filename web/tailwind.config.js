/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          500: "#0e9f6e",
          600: "#00805a",
          700: "#00694e",
          800: "#00513d",
          900: "#003b2c",
        },
        accent: { DEFAULT: "#f42a41", 600: "#d91e34" },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Bengali", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
