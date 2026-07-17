// Adapter only: every value comes from packages/tokens so mobile and web
// cannot drift. Mobile is on Tailwind v3 because stable NativeWind targets v3
// while web is on v4 (D-016) - the majors differ, the design does not.
//
// The theme is required from a generated .cjs because this file is CommonJS
// and @finmanager/tokens is ESM.
const theme = require('@finmanager/tokens/nativewind-theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' rather than 'media': the in-app theme toggle must be able to
  // override the OS setting, which a media query cannot express.
  darkMode: 'class',
  theme: { extend: theme },
  plugins: [],
};
