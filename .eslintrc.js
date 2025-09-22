module.exports = {
  root: true, // This stops ESLint from looking in parent directories
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'commonjs'
  },
  ignorePatterns: [
    'node_modules/**',
    'coverage/**',
    'dist/**',
    'build/**',
    '*.min.js',
    'chess-analyzer-frontend/**'
  ],
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'caughtErrorsIgnorePattern': '^_',
      'ignoreRestSiblings': true
    }],
    'no-console': 'off', // Allow console.log for conditional logging
    'comma-dangle': ['error', 'never'],
    'eqeqeq': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'keyword-spacing': 'error',
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    'prefer-const': 'warn',
    'no-var': 'error',
    // Disable some stricter rules for now
    'no-shadow': 'warn',
    'no-return-await': 'warn',
    'handle-callback-err': 'warn'
  }
};