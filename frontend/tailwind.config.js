/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f6f7ef', 100: '#eef0e8', 200: '#dce0d4', 300: '#c9d0c2',
          400: '#81907e', 500: '#5e6c5c', 600: '#495646', 700: '#3b4739',
          800: '#333d30', 900: '#212820', 950: '#151b15',
        },
        cyan: {
          50: '#f0f7e5', 100: '#e6f2d2', 200: '#d7e8b4', 300: '#c8e590',
          400: '#b9db70', 500: '#8ab039', 600: '#527322', 700: '#405b1b',
          800: '#364a1e', 900: '#29391a', 950: '#1d2a14',
        },
        gym: {
          dark: '#161a16',
          surface: '#202620',
          card: '#282e26',
          border: '#3a4438',
          accent: '#b9db70',
          'accent-hover': '#d8f963',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'Arial Narrow', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
