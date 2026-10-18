const { colors, fontFamily, fontSize, borderRadius, spacing } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is light-only (app.json userInterfaceStyle). 'class' stops NativeWind's web runtime
  // throwing "Cannot manually set color scheme, as dark mode is type 'media'" on load.
  darkMode: 'class',
  theme: {
    extend: { colors, fontFamily, fontSize, borderRadius, spacing },
  },
  plugins: [],
};
