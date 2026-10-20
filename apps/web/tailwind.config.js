// Same Alexandria tokens as the mobile app (apps/mobile/src/theme/tokens.js); only the font
// families differ: the browser loads the Google Fonts families instead of Expo's per-weight files.
import tokens from '../mobile/src/theme/tokens.js';

const { colors, fontSize, borderRadius, spacing } = tokens;

const sans = ['Inter', 'system-ui', 'sans-serif'];
const serif = ['"Noto Serif"', 'Georgia', 'serif'];
const label = ['"Public Sans"', 'system-ui', 'sans-serif'];

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors,
      fontSize,
      borderRadius,
      spacing,
      fontFamily: { headline: serif, serif, body: sans, label },
    },
  },
};
