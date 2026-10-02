'use strict';

const logger = require('./logger');

/** IPC message type that tells the ShardingManager to stop instead of respawning forever. */
const FATAL_MESSAGE = 'bot:fatal';

/**
 * Logs an unrecoverable error and stops this process. When running under the
 * ShardingManager it also tells the manager to shut down every shard.
 * @param {string} reason
 */
function fatal(reason) {
  logger.error(reason);
  if (process.send) {
    process.send({ type: FATAL_MESSAGE, reason }, () => process.exit(1));
  } else {
    process.exit(1);
  }
}

module.exports = { fatal, FATAL_MESSAGE };
