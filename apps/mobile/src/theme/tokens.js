// Design tokens — single source for tailwind.config.js and non-className code
// (e.g. LinearGradient colors). Colors and typeface follow the Campus Bites brand kit
// (brand-kit/: the five-green Timberwolf to Brunswick palette; Nunito Sans); spacing, type sizes and
// radii keep the Alexandria scale from stitch-reference/.
// CommonJS so tailwind.config.js can require it.

const colors = {
  // Palette (brand-kit/Design.txt, coolors.co/palette/dad7cd-a3b18a-588157-3a5a40-344e41):
  // Timberwolf #DAD7CD (background), Sage #A3B18A, Fern #588157 (accent), Hunter #3A5A40
  // (primary), Brunswick #344E41 (deep). Tonal tiers are derived from those five.
  primary: '#3a5a40',
  'on-primary': '#f5f4f0',
  'primary-container': '#588157',
  'on-primary-container': '#d5ddc8',
  'primary-fixed': '#dde6d5',
  'primary-fixed-dim': '#a3b18a',
  'on-primary-fixed': '#132418',
  'on-primary-fixed-variant': '#2c4432',
  'inverse-primary': '#a3b18a',
  'surface-tint': '#3a5a40',

  secondary: '#5d6656',
  'on-secondary': '#ffffff',
  'secondary-container': '#e2e5da',
  'on-secondary-container': '#40483b',
  'secondary-fixed': '#e2e5da',
  'secondary-fixed-dim': '#c4c9b8',
  'on-secondary-fixed': '#191e15',
  'on-secondary-fixed-variant': '#40483b',

  // Sage family for official / verified; `tertiary` is a deeper olive-sage so it stays legible
  // as text and reads apart from the hunter primary.
  tertiary: '#66744e',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#a3b18a',
  'on-tertiary-container': '#232b14',
  'tertiary-fixed': '#e6ebd9',
  'tertiary-fixed-dim': '#c5cfb0',
  'on-tertiary-fixed': '#1d2510',
  'on-tertiary-fixed-variant': '#4b5734',
  // Fern: logo bite marks and "Bites" in the wordmark on light surfaces.
  accent: '#588157',
  'accent-soft': '#e1eadb',

  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',

  // Timberwolf canvas; white panels (surface-container-lowest) stand clear of it and also get a
  // `card-edge` hairline and a soft `card-shadow`.
  background: '#dad7cd',
  'on-background': '#1b211c',
  surface: '#f5f4f0',
  'surface-bright': '#f8f7f4',
  'surface-dim': '#c8c4b7',
  'surface-variant': '#e3e1d8',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f7f6f2',
  'surface-container': '#f1f0ea',
  'surface-container-high': '#ebe9e2',
  'surface-container-highest': '#e4e2da',
  'on-surface': '#1b211c',
  'on-surface-variant': '#4a5148',
  'inverse-surface': '#344e41',
  'inverse-on-surface': '#f5f4f0',
  outline: '#757a6f',
  'outline-variant': '#b8b4a6',
  'card-edge': '#c6c2b4',
  'card-shadow': 'rgba(38, 52, 40, 0.14)',

  // Status semantics: a bright leaf green that reads apart from the hunter / fern greens, and a
  // honey amber.
  'status-open': '#22a06b',
  'status-open-container': '#e3f5ea',
  'on-status-open-container': '#11573a',
  'status-warning-container': '#fff1d6',
  'on-status-warning-container': '#6b4100',
  'status-warning': '#e5a12e',

  // Deep end of the hero gradient (hero cards run hero -> primary).
  hero: '#1f3128',
};

// Each weight is its own family on Android, so weights are separate font-* utilities.
const fontFamily = {
  headline: ['NunitoSans_800ExtraBold'],
  'headline-medium': ['NunitoSans_700Bold'],
  serif: ['NunitoSans_400Regular'],
  body: ['NunitoSans_400Regular'],
  'body-medium': ['NunitoSans_500Medium'],
  'body-semibold': ['NunitoSans_600SemiBold'],
  'body-bold': ['NunitoSans_700Bold'],
  label: ['NunitoSans_600SemiBold'],
  'label-bold': ['NunitoSans_700Bold'],
};

// Sizes from the export; weights are carried by fontFamily above.
const fontSize = {
  'headline-xl': ['40px', { lineHeight: '48px' }],
  'headline-xl-mobile': ['30px', { lineHeight: '38px' }],
  'headline-lg': ['32px', { lineHeight: '40px' }],
  'headline-lg-mobile': ['24px', { lineHeight: '32px' }],
  'headline-md': ['22px', { lineHeight: '28px' }],
  'headline-sm': ['18px', { lineHeight: '24px' }],
  'body-lg': ['16px', { lineHeight: '24px' }],
  'body-md': ['14px', { lineHeight: '20px' }],
  'body-sm': ['12px', { lineHeight: '18px' }],
  'label-lg': ['14px', { lineHeight: '20px' }],
  'label-md': ['12px', { lineHeight: '16px' }],
  'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.55px' }],
};

// Export radii are rem-based (0.125/0.25/0.5rem); `full` is a true pill here so
// avatars and status pills stay round.
const borderRadius = {
  sm: '2px',
  DEFAULT: '2px',
  lg: '4px',
  xl: '8px',
  '2xl': '12px',
  '3xl': '20px',
  '4xl': '28px',
  full: '9999px',
};

const spacing = {
  'space-xs': '4px',
  'space-sm': '8px',
  'space-md': '16px',
  'space-lg': '24px',
  'space-xl': '32px',
  gutter: '16px',
  margin: '16px',
};

module.exports = { colors, fontFamily, fontSize, borderRadius, spacing };
