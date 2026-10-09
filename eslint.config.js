import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'dev-dist/**', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  /*
    Los recorridos de navegador: Node y CommonJS, no navegador.

    Van en `.cjs` porque el front es ESM y sin esa extensión `require` no
    existe, así que `console` y `process` les salían como variables inventadas y
    dejaban `eslint .` en rojo por cuatro guiones que no se despliegan con nada.

    Llevan los globales del navegador ADEMÁS de los de Node porque lo que va
    dentro de `page.evaluate()` se ejecuta en la pestaña, no aquí: ahí `document`
    es tan real como `process` fuera.
  */
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
