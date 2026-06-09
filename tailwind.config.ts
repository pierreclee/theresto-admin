import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#004E89',
        background: '#F5F5F5',
        error: '#E63946',
        success: '#06D6A0',
        warning: '#F4A261',
      },
    },
  },
  plugins: [],
};

export default config;
