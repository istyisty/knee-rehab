/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:   { 950: '#0a0c0f', 900: '#0f1216', 850: '#151920', 800: '#1c212a', 700: '#2a313d', 600: '#3b4453', 500: '#5a6474' },
        mint:  { 400: '#4ade9f', 500: '#22c98a', 600: '#12a870' },
        amber: { 400: '#fbbf5c', 500: '#f5a524' },
        rose:  { 400: '#fb7185', 500: '#f43f5e' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: { lift: '0 8px 30px -12px rgba(0,0,0,.7)' },
    },
  },
  plugins: [],
}
