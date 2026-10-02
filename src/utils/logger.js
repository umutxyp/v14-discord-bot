'use strict';

const { inspect } = require('node:util');

const useColor = Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env);

const LEVELS = {
  debug: { label: 'DEBUG', color: 90 },
  info: { label: 'INFO ', color: 36 },
  success: { label: 'OK   ', color: 32 },
  warn: { label: 'WARN ', color: 33 },
  error: { label: 'ERROR', color: 31 },
};

const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);

const format = (value) => (typeof value === 'string' ? value : inspect(value, { depth: 4, colors: useColor }));

/**
 * Creates a small, dependency-free logger that prefixes every line with a scope
 * (for example `Manager` or `Shard 0`) so output from many processes stays readable.
 * @param {string} scope
 */
function createLogger(scope) {
  const write = (level, values) => {
    const { label, color } = LEVELS[level];
    const time = new Date().toISOString().slice(11, 19);
    const line = `${paint(90, time)} ${paint(color, label)} ${paint(35, `[${scope}]`)} ${values.map(format).join(' ')}`;
    (level === 'error' || level === 'warn' ? console.error : console.log)(line);
  };

  return {
    debug: (...values) => write('debug', values),
    info: (...values) => write('info', values),
    success: (...values) => write('success', values),
    warn: (...values) => write('warn', values),
    error: (...values) => write('error', values),
  };
}

// Child processes spawned by the ShardingManager receive their shard IDs through `SHARDS`.
const defaultScope = process.env.SHARDS ? `Shard ${[JSON.parse(process.env.SHARDS)].flat().join(',')}` : 'Bot';

module.exports = createLogger(defaultScope);
module.exports.createLogger = createLogger;
