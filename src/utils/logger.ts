/**
 * Simple logger utility for Noor backend.
 * Provides colored, prefixed console output for info, error, warn, and success messages.
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/** Logs an informational message in cyan */
export const logInfo = (message: string): void => {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
};

/** Logs an error message in red */
export const logError = (message: string, error?: unknown): void => {
  console.error(`${colors.red}[ERROR]${colors.reset} ${message}`, error ?? '');
};

/** Logs a warning message in yellow */
export const logWarn = (message: string): void => {
  console.warn(`${colors.yellow}[WARN]${colors.reset} ${message}`);
};

/** Logs a success message in green */
export const logSuccess = (message: string): void => {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
};
