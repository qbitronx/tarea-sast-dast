import security from 'eslint-plugin-security';

export default [
  security.configs.recommended,
  {
    rules: {
      // ── Advertencias (pueden ser falsos positivos en ciertos patrones) ──
      'security/detect-object-injection':        'warn',  // obj[key] dinámico
      'security/detect-non-literal-regexp':      'warn',  // new RegExp(variable)
      'security/detect-non-literal-fs-filename': 'warn',  // path traversal
      'security/detect-non-literal-require':     'warn',  // require(variable)

      // ── Errores — vulnerabilidades graves ────────────────────────────────
      'security/detect-unsafe-regex':                'error', // ReDoS
      'security/detect-possible-timing-attacks':     'error', // timing attack en comparación de strings
      'security/detect-child-process':               'error', // ejecución arbitraria de comandos
      'security/detect-eval-with-expression':        'error', // eval con expresión dinámica
      'security/detect-new-buffer':                  'error', // Buffer(string) inseguro
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-pseudoRandomBytes':           'error', // Math.random para seguridad
      'security/detect-disable-mustache-escape':     'error',

      // ── Reglas nativas de ESLint con impacto en seguridad ────────────────
      'no-eval':         'error', // ejecución de código arbitrario
      'no-implied-eval': 'error', // setTimeout/setInterval con string
      'no-new-func':     'error', // new Function(string)
      'no-process-exit': 'warn',  // salida abrupta sin limpieza
    },
  },
];
