'use strict';

/**
 * Thrown when a user invokes a command with missing or invalid arguments.
 * The command runner catches it and replies with the message plus the command's usage.
 */
class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

module.exports = UsageError;
