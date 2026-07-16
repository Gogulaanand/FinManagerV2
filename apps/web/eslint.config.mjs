// eslint-config-next v16 ships native flat configs; core-web-vitals already
// includes the next/typescript rules.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

import rootConfig from '../../eslint.config.mjs';

const config = [
  ...rootConfig,
  ...nextCoreWebVitals,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default config;
