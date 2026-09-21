const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function format(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) console.log(format('debug', message, meta));
  },
  info: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) console.log(format('info', message, meta));
  },
  warn: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) console.warn(format('warn', message, meta));
  },
  error: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) console.error(format('error', message, meta instanceof Error ? meta.message : meta));
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('Logger test');
  logger.debug('Debug message');
  logger.warn('Warning message');
  logger.error('Error message', new Error('Test error'));
}