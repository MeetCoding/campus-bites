// Alexandria design tokens — single source for tailwind.config.js and non-className code
// (e.g. LinearGradient colors). Colors, spacing and type sizes come from the Stitch export
// tailwind.config in stitch-reference/*/code.html; font families follow
// stitch-reference/alexandria/DESIGN.md (Noto Serif / Inter / Public Sans).
// CommonJS so tailwind.config.js can require it.

const colors = {
  primary: '#094cb2',
  'on-primary': '#ffffff',
  'primary-container': '#3366cc',
  'on-primary-container': '#e7ebff',
  'primary-fixed': '#d9e2ff',
  'primary-fixed-dim': '#b1c5ff',
  'on-primary-fixed': '#001946',
  'on-primary-fixed-variant': '#00419d',
  'inverse-primary': '#b1c5ff',
  'surface-tint': '#2259bf',

  secondary: '#5a5f63',
  'on-secondary': '#ffffff',
  'secondary-container': '#dfe3e8',
  'on-secondary-container': '#606569',
  'secondary-fixed': '#dfe3e8',
  'secondary-fixed-dim': '#c2c7cc',
  'on-secondary-fixed': '#171c20',
  'on-secondary-fixed-variant': '#42474b',

  tertiary: '#6d5e00',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#bfab49',
  'on-tertiary-container': '#4a3f00',
  'tertiary-fixed': '#f9e37a',
  'tertiary-fixed-dim': '#dcc661',
  'on-tertiary-fixed': '#211b00',
  'on-tertiary-fixed-variant': '#524600',

  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',

  background: '#faf9fa',
  'on-background': '#1b1c1d',
  surface: '#faf9fa',
  'surface-bright': '#faf9fa',
  'surface-dim': '#dbdadb',
  'surface-variant': '#e3e2e3',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f5f3f4',
  'surface-container': '#efedee',
  'surface-container-high': '#e9e8e9',
  'surface-container-highest': '#e3e2e3',
  'on-surface': '#1b1c1d',
  'on-surface-variant': '#434653',
  'inverse-surface': '#303031',
  'inverse-on-surface': '#f2f0f1',
  outline: '#737784',
  'outline-variant': '#c3c6d5',

  // Status semantics used across the Stitch screens
  'status-open': '#10b981',
  'status-open-container': '#ecfdf5',
  'on-status-open-container': '#065f46',
  'status-warning-container': '#fffbeb',
  'on-status-warning-container': '#78350f',
};

// Each weight is its own family on Android, so weights are separate font-* utilities.
const fontFamily = {
  headline: ['NotoSerif_700Bold'],
  'headline-medium': ['NotoSerif_500Medium'],
  serif: ['NotoSerif_400Regular'],
  body: ['Inter_400Regular'],
  'body-medium': ['Inter_500Medium'],
  'body-semibold': ['Inter_600SemiBold'],
  'body-bold': ['Inter_700Bold'],
  label: ['PublicSans_500Medium'],
  'label-bold': ['PublicSans_700Bold'],
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
