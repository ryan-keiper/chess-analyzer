/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          light: '#f0d9b5',
          dark: '#b58863',
          primary: '#2563eb',
          success: '#059669',
          warning: '#d97706',
          danger: '#dc2626',
        }
      },
      fontFamily: {
        'chess': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
