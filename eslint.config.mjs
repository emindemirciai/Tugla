import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Single flat config for the whole monorepo. Style is Prettier's job; lint
 * focuses on correctness rules that catch real bugs.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/www/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'tests/**/*.js',
      '**/*.config.*',
      'packages/database/prisma/seed.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    // NestJS dependency injection reads constructor parameter types at runtime
    // via emitDecoratorMetadata; type-only imports would erase them.
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    files: ['tests/load/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly' } },
  },
);
