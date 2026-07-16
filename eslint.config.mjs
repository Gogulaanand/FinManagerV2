import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config. Apps extend this with their platform config
 * (see apps/web/eslint.config.mjs, apps/mobile/eslint.config.mjs).
 *
 * Rules are syntactic only for now; type-aware linting is deferred until the
 * domain packages carry real logic worth checking that way.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Tooling config files (metro, babel, postcss) are CommonJS and run in Node.
    files: ['**/*.cjs', '**/*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.config.{ts,mts,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      // Type-only import discipline is enforced by verbatimModuleSyntax in
      // tsconfig.base.json rather than by a type-aware lint rule (see D-011).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
