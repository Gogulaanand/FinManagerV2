// eslint-config-next v16 ships native flat configs; core-web-vitals already
// includes the next/typescript rules.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

import rootConfig from '../../eslint.config.mjs';

// Next 16's core-web-vitals flat config uses a different TypeScript ESLint
// parser/plugin combination. Keep the shared JavaScript/prettier rules here;
// TypeScript is checked by `tsc` and Next owns the framework lint rules.
const rootConfigWithoutTypeScriptRules = rootConfig.filter(
  (entry) =>
    !entry.name?.startsWith('typescript-eslint/') &&
    !Object.keys(entry.rules ?? {}).some((rule) => rule.startsWith('@typescript-eslint/')) &&
    (!entry.plugins || !('@typescript-eslint' in entry.plugins)),
);

const nextConfigWithoutTypeScriptPlugin = nextCoreWebVitals.filter(
  (entry) => !entry.plugins || !('@typescript-eslint' in entry.plugins),
);

const config = [
  ...rootConfigWithoutTypeScriptRules,
  ...nextConfigWithoutTypeScriptPlugin,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default config;
