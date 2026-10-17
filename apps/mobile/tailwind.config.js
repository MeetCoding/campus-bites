const { colors, fontFamily, fontSize, borderRadius, spacing } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: { colors, fontFamily, fontSize, borderRadius, spacing },
  },
  plugins: [],
};
