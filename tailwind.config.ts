import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        highlight: '#00D4AA',
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};

export default config;
