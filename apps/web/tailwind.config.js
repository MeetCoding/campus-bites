// Same brand tokens as the mobile app (apps/mobile/src/theme/tokens.js); only the font
// families differ: the browser loads Nunito Sans from Google Fonts instead of Expo's per-weight files.
import tokens from '../mobile/src/theme/tokens.js';

const { colors, fontSize, borderRadius, spacing } = tokens;

const sans = ['"Nunito Sans"', 'Nunito', 'system-ui', 'sans-serif'];

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors,
      fontSize,
      borderRadius,
      spacing,
      fontFamily: { headline: sans, serif: sans, body: sans, label: sans },
    },
  },
};
