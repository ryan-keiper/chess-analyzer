// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless debugging
  log: process.env.DEBUG ? console.log : jest.fn(),
  error: console.error,
  warn: console.warn,
};
