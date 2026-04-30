import security from 'eslint-plugin-security';
import react from 'eslint-plugin-react';

export default [
  security.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── Advertencias ────────────────────────────────────────────────────
      'security/detect-object-injection':        'warn',
      'security/detect-non-literal-regexp':      'warn',

      // ── Errores — vulnerabilidades graves ────────────────────────────────
      'security/detect-unsafe-regex':            'error', // ReDoS
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-eval-with-expression':    'error',
      'security/detect-new-buffer':              'error',
      'security/detect-pseudoRandomBytes':       'error',

      // ── React — XSS ──────────────────────────────────────────────────────
      'react/no-danger':                'error', // dangerouslySetInnerHTML
      'react/no-danger-with-children':  'error',

      // ── ESLint nativo ────────────────────────────────────────────────────
      'no-eval':         'error',
      'no-implied-eval': 'error',
      'no-new-func':     'error',
      'no-script-url':   'error', // href="javascript:..."
    },
  },
];
