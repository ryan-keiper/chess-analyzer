// Global test setup - suppress console output during tests unless debugging
global.console = {
  ...console,
  // Suppress console output during tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  error: process.env.DEBUG ? console.error : jest.fn(),
  warn: process.env.DEBUG ? console.warn : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn()
};
