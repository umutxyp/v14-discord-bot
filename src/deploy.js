'use strict';

const { REST, Routes } = require('discord.js');
const config = require('./config');
const { createLogger } = require('./utils/logger');
const { loadCommands } = require('./utils/loader');

const logger = createLogger('Deploy');

/**
 * Overwrites the application's slash commands with the ones in `src/commands`.
 * Uses a guild scope when DEV_GUILD_ID is set (instant), otherwise global.
 * @param {object} options
 * @param {REST} options.rest
 * @param {string} options.applicationId
 */
async function deployCommands({ rest, applicationId }) {
  const { commands } = loadCommands({ silent: true });
  const body = commands.filter((command) => command.slash !== false).map((command) => command.data.toJSON());

  const route = config.devGuildId
    ? Routes.applicationGuildCommands(applicationId, config.devGuildId)
    : Routes.applicationCommands(applicationId);

  const registered = await rest.put(route, { body });
  logger.success(
    `Registered ${registered.length} slash commands ${config.devGuildId ? `in guild ${config.devGuildId}` : 'globally'}.`,
  );
  return registered;
}

module.exports = { deployCommands };

// `npm run deploy` — run this file directly.
if (require.main === module) {
  if (!config.token) {
    logger.error('DISCORD_TOKEN is missing. Copy .env.example to .env and paste your bot token.');
    process.exit(1);
  }

  const rest = new REST().setToken(config.token);
  rest
    .get(Routes.currentApplication())
    .then((application) => deployCommands({ rest, applicationId: application.id }))
    .catch((error) => {
      const reason = error.status === 401 ? 'the bot token is invalid. Check DISCORD_TOKEN in your .env file.' : error.message;
      logger.error(`Failed to register slash commands: ${reason}`);
      process.exitCode = 1;
    });
}
