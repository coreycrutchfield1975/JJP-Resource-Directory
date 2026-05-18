/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B3A6B', dark: '#0F2347', mid: '#254e91' },
        gold: { DEFAULT: '#C8941A', light: '#F0C84A', bg: '#FEF9E7' },
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        body: ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
